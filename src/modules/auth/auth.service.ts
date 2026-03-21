import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { UsersService } from '@/modules/users/users.service'
import { User } from '@/modules/users/entities/user.entity'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { ChangePasswordDto } from './dto/change-password.dto'

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validates a user's credentials by checking the provided email and password.
   * Uses a single generic error message to prevent user enumeration attacks.
   *
   * @param {string} email - The email address of the user to validate.
   * @param {string} password - The password of the user to validate.
   * @returns A promise that resolves to the authenticated user object.
   * @throws {UnauthorizedException} If credentials are invalid.
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email)

    if (!user) {
      throw new UnauthorizedException('Invalid email or password')
    }

    const isMatch: boolean = bcrypt.compareSync(password, user.password)

    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password')
    }

    return user
  }

  /**
   * Authenticates a user and generates an access token.
   *
   * @param {User} user - The user object containing user details.
   * @returns {Promise<{ access_token: string }>} A promise that resolves to an object containing the access token.
   */
  async login(user: User): Promise<{ access_token: string }> {
    const payload = { email: user.email, id: user.id, roles: user.roles }

    return { access_token: this.jwtService.sign(payload) }
  }

  /**
   * Determines the highest role level for the given roles array.
   * Hierarchy: super_admin > admin > user
   */
  private computeHighestRole(roles: string[]): 'super_admin' | 'admin' | 'user' {
    const normalized = roles.map((roleName) => roleName.toLowerCase().replace(/[\s_]+/g, ''))
    if (normalized.some((roleName) => roleName === 'superadmin' || roleName === 'super'))
      return 'super_admin'
    if (normalized.some((roleName) => roleName === 'admin')) return 'admin'
    return 'user'
  }

  async getProfile(userId: number): Promise<Omit<User, 'password'>> {
    const user = await this.usersService.findOneWithPermissions(userId)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    Reflect.deleteProperty(user, 'password')

    // Prototype getters are not serialized to JSON — promote them to own enumerable properties.
    const roles = user.roles
    Object.defineProperty(user, 'roles', { value: roles, enumerable: true, configurable: true })
    Object.defineProperty(user, 'full_name', {
      value: user.full_name,
      enumerable: true,
      configurable: true,
    })
    Object.defineProperty(user, 'highest_role', {
      value: this.computeHighestRole(roles),
      enumerable: true,
      configurable: true,
    })

    return user as unknown as Omit<User, 'password'>
  }

  /**
   * Updates the authenticated user's personal profile information.
   *
   * @param {number} userId - The ID of the authenticated user.
   * @param {UpdateProfileDto} dto - Fields to update.
   * @returns The updated user profile without the password field.
   */
  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<Omit<User, 'password'>> {
    await this.usersService.update(userId, dto)
    return this.getProfile(userId)
  }

  /**
   * Changes the authenticated user's password after verifying the current one.
   *
   * @param {number} userId - The ID of the authenticated user.
   * @param {ChangePasswordDto} dto - Contains current_password and new_password.
   * @throws {BadRequestException} If the current password is incorrect.
   */
  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findOneWithPermissions(userId)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const isMatch = bcrypt.compareSync(dto.current_password, user.password)

    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect')
    }

    await this.usersService.update(userId, { password: dto.new_password })
  }
}
