import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common'
import { UserContractsService } from './user_contracts.service'
import { CreateUserContractDto } from './dto/create-user-contract.dto'
import { UpdateUserContractDto } from './dto/update-user-contract.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('user-contracts')
@UseGuards(PermissionsGuard)
export class UserContractsController {
  constructor(private readonly userContractsService: UserContractsService) {}

  /**
   * Create a new contract for a user.
   */
  @Post()
  @Permissions('all_privileges', 'create')
  create(@Body(ValidationPipe) createDto: CreateUserContractDto) {
    return this.userContractsService.create(createDto)
  }

  /**
   * Get all contracts for a specific user.
   */
  @Get('user/:userId')
  @Permissions('all_privileges', 'read')
  findByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.userContractsService.findByUser(userId)
  }

  /**
   * Update a contract by ID.
   */
  @Put(':id')
  @Permissions('all_privileges', 'update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateDto: UpdateUserContractDto,
  ) {
    return this.userContractsService.update(id, updateDto)
  }

  /**
   * Delete a contract by ID.
   */
  @Delete(':id')
  @Permissions('all_privileges', 'delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userContractsService.remove(id)
  }
}
