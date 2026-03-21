import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
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
  findAll(
    @Query('search') search?: string,
    @Query('id') userId?: string,
    @Query('name') name?: string,
    @Query('position') position?: string,
    @Query('email') email?: string,
    @Query('department_id') departmentId?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('contract_type') contractType?: string,
  ) {
    if (search) {
      return this.usersService.search(search)
    }

    const hasFilter =
      userId || name || position || email || departmentId || role || status || contractType

    if (hasFilter) {
      return this.usersService.findWithFilters({
        userId: userId ? parseInt(userId, 10) : undefined,
        name,
        position,
        email,
        departmentId: departmentId ? parseInt(departmentId, 10) : undefined,
        role,
        status,
        contractType,
      })
    }

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
