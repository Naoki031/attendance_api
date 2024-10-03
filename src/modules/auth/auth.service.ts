import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '@/modules/users/users.service';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validates a user's credentials by checking the provided email and password.
   *
   * @param {string} email - The email address of the user to validate.
   * @param {string} password - The password of the user to validate.
   * @returns A promise that resolves to the user object if validation is successful.
   * @throws {BadRequestException} If the user is not found or the password does not match.
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isMatch: boolean = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
      throw new BadRequestException('Password does not match');
    }

    return user;
  }

  /**
   * Authenticates a user and generates an access token.
   *
   * @param {User} user - The user object containing user details.
   * @returns {Promise<{ access_token: string }>} A promise that resolves to an object containing the access token.
   */
  async login(user: User): Promise<{ access_token: string }> {
    const payload = { email: user.email, user_id: user.id, roles: user.roles };

    return { access_token: this.jwtService.sign(payload) };
  }
}
