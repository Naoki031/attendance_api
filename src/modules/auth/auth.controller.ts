import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Request,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthGuard } from '@nestjs/passport'
import { Public } from './decorators/public.decorator'
import { User } from './decorators/user.decorator'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { ChangePasswordDto } from './dto/change-password.dto'

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @Post('login')
  login(@Request() request) {
    const accessToken = this.authService.login(request.user)

    return accessToken
  }

  @Post('logout')
  logout() {
    return 'Logged out successfully'
  }

  @Get('user')
  getProfile(@User() user) {
    return this.authService.getProfile(user.id)
  }

  @Put('profile')
  updateProfile(@User() user, @Body(ValidationPipe) dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto)
  }

  @Put('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@User() user, @Body(ValidationPipe) dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto)
  }
}
