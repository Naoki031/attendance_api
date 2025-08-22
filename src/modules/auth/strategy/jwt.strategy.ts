import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_KEY'),
    });
  }

  /**
   * Validates the JWT payload.
   *
   * @param payload - The JWT payload to validate.
   * @returns An object containing the user ID and email extracted from the payload.
   */
  async validate(payload: any) {
    return { id: payload.user_id, email: payload.email };
  }
}
