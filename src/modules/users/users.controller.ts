import {
  BadRequestException,
  ForbiddenException,
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Put,
  Param,
  Delete,
  Query,
  ClassSerializerInterceptor,
  UseInterceptors,
  UseGuards,
  ValidationPipe,
  ParseIntPipe,
  UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto'
import { ReviewKycDto } from './dto/review-kyc.dto'
import { User } from '@/modules/auth/decorators/user.decorator'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import type { User as UserEntity } from '@/modules/users/entities/user.entity'
import { isPrivilegedUser } from '@/common/utils/is-privileged.utility'

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto)
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('id') userId?: string,
    @Query('name') name?: string,
    @Query('position') position?: string,
    @Query('email') email?: string,
    @Query('department_id') departmentId?: string,
    @Query('company_id') companyId?: string,
    @Query('company_ids') companyIds?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('contract_type') contractType?: string,
    @Query('kyc_status') kycStatus?: string,
  ) {
    if (search) {
      return this.usersService.search(search)
    }

    const parsedCompanyIds = companyIds
      ? companyIds
          .split(',')
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id))
      : undefined

    const hasFilter =
      userId ||
      name ||
      position ||
      email ||
      departmentId ||
      companyId ||
      companyIds ||
      role ||
      status ||
      contractType ||
      kycStatus

    if (hasFilter) {
      return this.usersService.findWithFilters({
        userId: userId ? parseInt(userId, 10) : undefined,
        name,
        position,
        email,
        departmentId: departmentId ? parseInt(departmentId, 10) : undefined,
        companyId: companyId ? parseInt(companyId, 10) : undefined,
        companyIds: parsedCompanyIds,
        role,
        status,
        contractType,
        kycStatus,
      })
    }

    return this.usersService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') userId: string) {
    return this.usersService.findOne(+userId)
  }

  @Put(':id')
  update(@Param('id') userId: string, @Body(ValidationPipe) updateUserDto: UpdateUserDto) {
    return this.usersService.update(+userId, updateUserDto)
  }

  @Delete(':id')
  remove(@Param('id') userId: string) {
    return this.usersService.remove(+userId)
  }

  @Post(':id/face')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp']

        if (!allowed.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Only JPEG, PNG, or WEBP images are allowed'),
            false,
          )
        }

        callback(null, true)
      },
    }),
  )
  async registerFace(
    @Param('id', ParseIntPipe) userId: number,
    @User() currentUser: UserEntity,
    @UploadedFile() imageFile: Express.Multer.File,
    @Body('descriptor') descriptorJson: string,
  ) {
    if (currentUser.id !== userId && !isPrivilegedUser(currentUser.roles)) {
      throw new ForbiddenException('You can only register your own face')
    }

    if (!imageFile) throw new BadRequestException('Image file is required')

    let descriptor: number[]

    try {
      descriptor = JSON.parse(descriptorJson)
    } catch {
      throw new BadRequestException('descriptor must be a valid JSON array')
    }

    if (
      !Array.isArray(descriptor) ||
      descriptor.length !== 128 ||
      !descriptor.every((value) => typeof value === 'number')
    ) {
      throw new BadRequestException('descriptor must be a 128-element numeric array')
    }

    return this.usersService.registerFace(userId, descriptor, imageFile)
  }

  @Patch(':id/kyc')
  @UseGuards(PermissionsGuard)
  @Permissions('update')
  reviewKyc(@Param('id', ParseIntPipe) userId: number, @Body(ValidationPipe) dto: ReviewKycDto) {
    return this.usersService.reviewKyc(userId, dto.status, dto.rejection_reason)
  }

  @Delete(':id/kyc')
  @UseGuards(PermissionsGuard)
  @Permissions('update')
  cancelKyc(@Param('id', ParseIntPipe) userId: number): Promise<void> {
    return this.usersService.cancelKyc(userId)
  }

  @Post('me/fcm-token')
  async updateFcmToken(
    @Body(ValidationPipe) dto: UpdateFcmTokenDto,
    @User() user: UserEntity,
  ): Promise<{ success: boolean }> {
    await this.usersService.updateFcmToken(user.id, dto.fcm_token)

    return { success: true }
  }
}
