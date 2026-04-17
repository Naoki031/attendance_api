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
import { ContractExpiryReminderService } from './contract_expiry_reminder.service'
import { CreateUserContractDto } from './dto/create-user-contract.dto'
import { UpdateUserContractDto } from './dto/update-user-contract.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'
import { User } from '@/modules/auth/decorators/user.decorator'

@Controller('user-contracts')
export class UserContractsController {
  constructor(
    private readonly userContractsService: UserContractsService,
    private readonly contractExpiryReminderService: ContractExpiryReminderService,
  ) {}

  /**
   * Create a new contract for a user.
   */
  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('all_privileges', 'create')
  create(@Body(ValidationPipe) createDto: CreateUserContractDto) {
    return this.userContractsService.create(createDto)
  }

  /**
   * Get all contracts for a specific user.
   */
  @Get('user/:userId')
  @UseGuards(PermissionsGuard)
  @Permissions('all_privileges', 'read')
  findByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.userContractsService.findByUser(userId)
  }

  /**
   * Update a contract by ID.
   */
  @Put(':id')
  @UseGuards(PermissionsGuard)
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
  @UseGuards(PermissionsGuard)
  @Permissions('all_privileges', 'delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userContractsService.remove(id)
  }

  /**
   * Returns pending contract expiry reminders sent today for the current user's companies.
   * Accessible by all authenticated users — service filters by admin/manager dept membership.
   */
  @Get('pending-reminders')
  getPendingReminders(@User() user: { id: number }) {
    return this.contractExpiryReminderService.getPendingReminders(user.id)
  }

  /**
   * Manually trigger contract expiry reminder checks (super admin only, for testing).
   */
  @Post('trigger-expiry-reminders')
  @UseGuards(PermissionsGuard)
  @Permissions('all_privileges')
  async triggerExpiryReminders() {
    await this.contractExpiryReminderService.handleContractExpiryReminders()
    return { message: 'Contract expiry reminder check triggered' }
  }
}
