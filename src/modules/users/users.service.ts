import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { User } from './entities/user.entity'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserGroupPermission } from '@/modules/user_group_permissions/entities/user_group_permission.entity'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserGroupPermission)
    private readonly userGroupPermissionRepository: Repository<UserGroupPermission>,
  ) {}

  /**
   * Creates a new user in the repository.
   *
   * @param {CreateUserDto} createUserDto - The data transfer object containing the details of the user to be created.
   * @returns {Promise<User>} A promise that resolves to the created user.
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
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
      relations: ['user_group_permissions', 'user_group_permissions.permission_group'],
    })
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
      relations: ['user_group_permissions', 'user_group_permissions.permission_group'],
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
}
