import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { User } from './entities/user.entity'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserGroupPermission } from '@/modules/user_group_permissions/entities/user_group_permission.entity'
import { StorageService } from '@/modules/storage/storage.service'
import { FirebaseService } from '@/modules/firebase/firebase.service'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserGroupPermission)
    private readonly userGroupPermissionRepository: Repository<UserGroupPermission>,
    private readonly storageService: StorageService,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Creates a new user in the repository.
   *
   * @param {CreateUserDto} createUserDto - The data transfer object containing the details of the user to be created.
   * @returns {Promise<User>} A promise that resolves to the created user.
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { email: createUserDto.email } })

    if (existing) {
      throw new ConflictException('Email already taken')
    }

    const { is_active, password, permission_group_ids, ...rest } = createUserDto
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALT_ROUNDS ?? '10'))
    const username = createUserDto.email.split('@')[0]

    const user = await this.userRepository.save({
      ...rest,
      username,
      password: hashedPassword,
      is_activated: is_active,
    })

    if (permission_group_ids?.length) {
      await this.userGroupPermissionRepository.save(
        permission_group_ids.map((permissionGroupId) => ({
          user_id: user.id,
          permission_group_id: permissionGroupId,
        })),
      )
    }

    return this.findOne(user.id)
  }

  /**
   * Retrieves all users from the repository.
   *
   * @returns {Promise<User[]>} A promise that resolves to an array of all users.
   */
  findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: [
        'user_group_permissions',
        'user_group_permissions.permission_group',
        'user_departments',
        'user_departments.department',
        'user_departments.company',
        'user_work_schedules',
      ],
    })
  }

  /**
   * Filters users by multiple optional criteria.
   * Uses subqueries for department and role to avoid corrupting loaded relations.
   *
   * @param params - Filter parameters: userId, name, position, email, departmentId, role, status, contractType.
   * @returns A promise that resolves to matching users with full relations.
   */
  async findWithFilters(parameters: {
    userId?: number
    name?: string
    position?: string
    email?: string
    departmentId?: number
    companyId?: number
    role?: string
    status?: string
    contractType?: string
    kycStatus?: string
  }): Promise<User[]> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.user_group_permissions', 'userGroupPermission')
      .leftJoinAndSelect('userGroupPermission.permission_group', 'permissionGroup')
      .leftJoinAndSelect('user.user_departments', 'userDepartment')
      .leftJoinAndSelect('userDepartment.department', 'department')
      .leftJoinAndSelect('userDepartment.company', 'company')
      .leftJoinAndSelect('user.user_work_schedules', 'userWorkSchedule')

    if (parameters.userId) {
      queryBuilder.andWhere('user.id = :userId', { userId: parameters.userId })
    }

    if (parameters.name) {
      const nameLike = `%${parameters.name.toLowerCase()}%`
      queryBuilder.andWhere(
        "(LOWER(user.first_name) LIKE :nameLike OR LOWER(user.last_name) LIKE :nameLike OR LOWER(CONCAT(user.first_name, ' ', user.last_name)) LIKE :nameLike)",
        { nameLike },
      )
    }

    if (parameters.position) {
      queryBuilder.andWhere('LOWER(user.position) LIKE :position', {
        position: `%${parameters.position.toLowerCase()}%`,
      })
    }

    if (parameters.email) {
      queryBuilder.andWhere('LOWER(user.email) LIKE :email', {
        email: `%${parameters.email.toLowerCase()}%`,
      })
    }

    if (parameters.departmentId) {
      queryBuilder.andWhere(
        'user.id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.department_id = :departmentId)',
        { departmentId: parameters.departmentId },
      )
    }

    if (parameters.companyId) {
      queryBuilder.andWhere(
        'user.id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.company_id = :companyId)',
        { companyId: parameters.companyId },
      )
    }

    if (parameters.role) {
      queryBuilder.andWhere(
        `user.id IN (
          SELECT ugp.user_id FROM user_group_permissions ugp
          INNER JOIN permission_groups pg ON ugp.permission_group_id = pg.id
          WHERE LOWER(pg.name) = :roleName
        )`,
        { roleName: parameters.role.toLowerCase() },
      )
    }

    if (parameters.status === 'active') {
      queryBuilder.andWhere('user.is_activated = :isActivated', { isActivated: true })
    } else if (parameters.status === 'inactive') {
      queryBuilder.andWhere('user.is_activated = :isActivated', { isActivated: false })
    }

    if (parameters.contractType) {
      queryBuilder.andWhere('LOWER(user.contract_type) LIKE :contractType', {
        contractType: `%${parameters.contractType.toLowerCase()}%`,
      })
    }

    if (
      parameters.kycStatus === 'pending' ||
      parameters.kycStatus === 'approved' ||
      parameters.kycStatus === 'rejected'
    ) {
      queryBuilder.andWhere('user.kyc_status = :kycStatus', { kycStatus: parameters.kycStatus })
    } else if (parameters.kycStatus === 'none') {
      queryBuilder.andWhere('user.kyc_status IS NULL')
    }

    return queryBuilder.getMany()
  }

  /**
   * Searches users by first name, last name, or email using a case-insensitive partial match.
   * Returns at most `limit` results to avoid loading the full table.
   *
   * @param {string} query - The search string.
   * @param {number} limit - Maximum number of results (default 20).
   * @returns {Promise<User[]>} A promise that resolves to matching users.
   */
  async search(query: string, limit = 20): Promise<User[]> {
    const lowerQuery = `%${query.toLowerCase()}%`
    const numericId = /^\d+$/.test(query) ? parseInt(query, 10) : null

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.first_name) LIKE :query', { query: lowerQuery })
      .orWhere('LOWER(user.last_name) LIKE :query', { query: lowerQuery })
      .orWhere('LOWER(user.email) LIKE :query', { query: lowerQuery })

    if (numericId !== null) {
      queryBuilder.orWhere('user.id = :id', { id: numericId })
    }

    return queryBuilder.take(limit).getMany()
  }

  /**
   * Finds a user by their email address.
   *
   * @param email - The email address of the user to find.
   * @returns A promise that resolves to the user if found.
   * @throws NotFoundException if no user is found with the given email address.
   */
  async findOneByEmail(email: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['user_group_permissions', 'user_group_permissions.permission_group'],
    })

    return user
  }

  async findOneWithPermissions(userId: number): Promise<User | undefined> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['user_group_permissions', 'user_group_permissions.permission_group'],
    })

    return user
  }

  /**
   * Retrieves a user from the repository based on the provided user ID.
   *
   * @param {number} userId - The ID of the user to retrieve.
   * @returns {Promise<User>} A promise that resolves to the user with the given ID.
   * @throws {NotFoundException} If the user with the given ID is not found.
   */
  async findOne(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        'user_group_permissions',
        'user_group_permissions.permission_group',
        'user_departments',
        'user_departments.department',
        'user_departments.company',
      ],
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  /**
   * Updates a user's information based on the provided user ID and update data.
   *
   * @param {number} userId - The ID of the user to update.
   * @param {UpdateUserDto} updateUserDto - The data to update the user with.
   * @returns {Promise<User>} A promise that resolves to the updated user.
   * @throws {NotFoundException} If the user with the given ID is not found.
   */
  async update(userId: number, updateUserDto: UpdateUserDto): Promise<User> {
    if (updateUserDto.email) {
      const existing = await this.userRepository.findOne({ where: { email: updateUserDto.email } })

      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already taken')
      }
    }

    const { is_active, password, permission_group_ids, ...rest } = updateUserDto
    const updateData: Partial<User> = { ...rest }

    if (password) {
      updateData.password = await bcrypt.hash(password, parseInt(process.env.SALT_ROUNDS ?? '10'))
    }

    if (is_active !== undefined) {
      updateData.is_activated = is_active
    }

    // MariaDB DATE columns require 'YYYY-MM-DD' format — strip ISO time portion if present
    const toDateOnly = (value?: string) => (value ? value.substring(0, 10) : undefined)
    if (updateData.date_of_birth) updateData.date_of_birth = toDateOnly(updateData.date_of_birth)
    if (updateData.join_date) updateData.join_date = toDateOnly(updateData.join_date)
    if (updateData.contract_signed_date)
      updateData.contract_signed_date = toDateOnly(updateData.contract_signed_date)
    if (updateData.contract_expired_date)
      updateData.contract_expired_date = toDateOnly(updateData.contract_expired_date)

    await this.userRepository.update({ id: userId }, updateData)

    if (permission_group_ids !== undefined) {
      await this.userGroupPermissionRepository.delete({ user_id: userId })

      if (permission_group_ids.length) {
        await this.userGroupPermissionRepository.save(
          permission_group_ids.map((permissionGroupId) => ({
            user_id: userId,
            permission_group_id: permissionGroupId,
          })),
        )
      }
    }

    return this.findOne(userId)
  }

  /**
   * Removes a user from the repository by their ID.
   *
   * @param id - The ID of the user to be removed.
   * @returns A promise that resolves to the result of the delete operation.
   */
  remove(id: number) {
    return this.userRepository.delete({ id })
  }

  /**
   * Updates the FCM token for the authenticated user.
   * Stores or replaces the device token used for push notifications.
   */
  async updateFcmToken(userId: number, token: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { fcm_token: token })
  }

  /**
   * Registers a face descriptor and avatar image for a user.
   * Validates descriptor length (must be exactly 128 elements), uploads the
   * image to S3, then persists descriptor and avatar URL on the user record.
   *
   * @param userId - Target user ID
   * @param descriptor - 128-element float array from face-api.js
   * @param imageFile - Avatar image file from multipart upload
   * @returns Updated user (descriptor field excluded from response)
   */
  async registerFace(
    userId: number,
    descriptor: number[],
    imageFile: Express.Multer.File,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')

    if (user.kyc_status === 'approved') {
      throw new ForbiddenException('KYC is already approved and cannot be re-submitted')
    }

    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      throw new BadRequestException('Face descriptor must be an array of exactly 128 numbers')
    }

    const avatarUrl = await this.storageService.uploadImage(imageFile.buffer, 'avatars', userId)

    await this.userRepository.update(
      { id: userId },
      {
        face_descriptor: descriptor,
        face_avatar_url: avatarUrl,
        kyc_status: 'pending',
        kyc_rejection_reason: null,
      },
    )

    const updatedUser = await this.findOne(userId)

    // Notify admins of the new KYC submission (fire-and-forget)
    void this.notifyAdminsKycSubmitted(user)

    return updatedUser
  }

  /**
   * Cancels a pending or rejected KYC submission, resetting the user's status to null.
   * Used by admins to allow the user to re-submit KYC.
   */
  async cancelKyc(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')

    if (!user.kyc_status) {
      throw new BadRequestException('Cannot cancel KYC: no submission found')
    }

    await this.userRepository.update(
      { id: userId },
      { kyc_status: null, kyc_rejection_reason: null },
    )
  }

  /**
   * Retrieves FCM tokens of all admin and super_admin users.
   */
  private async getAdminFcmTokens(): Promise<string[]> {
    const admins = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.user_group_permissions', 'ugp')
      .innerJoin('ugp.permission_group', 'pg')
      .where('LOWER(pg.name) IN (:...roles)', { roles: ['admin', 'super_admin'] })
      .andWhere('user.fcm_token IS NOT NULL')
      .select(['user.id', 'user.fcm_token'])
      .getMany()

    return admins.map((admin) => admin.fcm_token!).filter(Boolean)
  }

  /**
   * Sends a push notification to all admin users when a KYC submission is received.
   */
  private async notifyAdminsKycSubmitted(submittingUser: User): Promise<void> {
    try {
      const adminTokens = await this.getAdminFcmTokens()
      if (adminTokens.length === 0) return

      const userName =
        [submittingUser.first_name, submittingUser.last_name].filter(Boolean).join(' ') ||
        submittingUser.email

      await this.firebaseService.sendToDevices(
        adminTokens,
        'New KYC Submission',
        `${userName} has submitted a KYC request for review.`,
        { url: '/management/kyc', type: 'kyc_submission' },
      )
    } catch {
      // FCM errors must not affect the KYC flow
    }
  }

  /**
   * Admin reviews a pending KYC submission.
   * Approved → face is activated for attendance check-in.
   * Rejected → user must re-submit KYC; rejection reason is stored.
   */
  async reviewKyc(
    userId: number,
    status: 'approved' | 'rejected',
    rejectionReason?: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    if (!user.face_descriptor) throw new BadRequestException('User has not submitted KYC')

    if (user.kyc_status !== 'pending') {
      throw new BadRequestException(
        `KYC status is '${user.kyc_status}', only 'pending' can be reviewed`,
      )
    }

    await this.userRepository.update(
      { id: userId },
      {
        kyc_status: status,
        kyc_rejection_reason: status === 'rejected' ? (rejectionReason ?? null) : null,
      },
    )

    return this.findOne(userId)
  }

  /**
   * Updates the last_seen_at timestamp for the given user.
   * Intended to be called on every authenticated request (fire-and-forget).
   */
  async updateLastSeen(userId: number): Promise<void> {
    await this.userRepository.update({ id: userId }, { last_seen_at: new Date() })
  }

  /**
   * Returns a map of userId → fcm_token for a list of user IDs.
   * Only includes users who have a non-null token.
   */
  async getFcmTokensForUsers(userIds: number[]): Promise<Map<number, string>> {
    if (userIds.length === 0) return new Map()

    const users = await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.fcm_token'])
      .where('user.id IN (:...userIds)', { userIds })
      .andWhere('user.fcm_token IS NOT NULL')
      .getMany()

    return new Map(users.map((user) => [user.id, user.fcm_token!]))
  }
}
