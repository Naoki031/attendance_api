import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ClassSerializerInterceptor,
  UseInterceptors,
} from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto)
  }

  @Get()
  findAll() {
    return this.usersService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') userId: string) {
    return this.usersService.findOne(+userId)
  }

  @Put(':id')
  update(@Param('id') userId: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+userId, updateUserDto)
  }

  @Delete(':id')
  remove(@Param('id') userId: string) {
    return this.usersService.remove(+userId)
  }
}
