import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserContract } from './entities/user_contract.entity'
import { User } from '@/modules/users/entities/user.entity'
import { CreateUserContractDto } from './dto/create-user-contract.dto'
import { UpdateUserContractDto } from './dto/update-user-contract.dto'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

@Injectable()
export class UserContractsService {
  private readonly logger = new Logger(UserContractsService.name)

  constructor(
    @InjectRepository(UserContract)
    private readonly userContractRepository: Repository<UserContract>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  /**
   * Creates a new contract for a user.
   * Auto-assigns the next sequential contract_number and syncs user's contract fields.
   */
  async create(createDto: CreateUserContractDto): Promise<UserContract> {
    try {
      const latest = await this.userContractRepository.findOne({
        where: { user_id: createDto.user_id },
        order: { contract_number: 'DESC' },
      })

      const nextNumber = (latest?.contract_number ?? 0) + 1

      const saved = await this.userContractRepository.save({
        user_id: createDto.user_id,
        contract_number: nextNumber,
        contract_type: createDto.contract_type,
        signed_date: createDto.signed_date,
        expired_date: createDto.expired_date ?? null,
        notes: createDto.notes ?? null,
      })

      await this.syncUserContractFields(createDto.user_id)

      return saved
    } catch (error) {
      this.logger.error('Failed to create user contract', error)
      this.errorLogsService.logError({
        message: 'Failed to create user contract',
        stackTrace: (error as Error).stack ?? null,
        path: 'user-contracts',
      })
      throw error
    }
  }

  /**
   * Retrieves all contracts for a user, ordered by contract_number ascending.
   */
  async findByUser(userId: number): Promise<UserContract[]> {
    try {
      return await this.userContractRepository.find({
        where: { user_id: userId },
        order: { contract_number: 'ASC' },
      })
    } catch (error) {
      this.logger.error('Failed to fetch user contracts', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch user contracts',
        stackTrace: (error as Error).stack ?? null,
        path: 'user-contracts',
      })
      throw error
    }
  }

  /**
   * Updates an existing contract and syncs the user's contract fields.
   */
  async update(id: number, updateDto: UpdateUserContractDto): Promise<UserContract> {
    try {
      const contract = await this.userContractRepository.findOne({ where: { id } })
      if (!contract) throw new NotFoundException('Contract not found')

      const updateData: Partial<UserContract> = {}
      if (updateDto.contract_type !== undefined) updateData.contract_type = updateDto.contract_type
      if (updateDto.signed_date !== undefined) updateData.signed_date = updateDto.signed_date
      if (updateDto.expired_date !== undefined) updateData.expired_date = updateDto.expired_date
      if (updateDto.notes !== undefined) updateData.notes = updateDto.notes

      await this.userContractRepository.update({ id }, updateData)
      await this.syncUserContractFields(contract.user_id)

      const updated = await this.userContractRepository.findOne({ where: { id } })
      return updated!
    } catch (error) {
      this.logger.error('Failed to update user contract', error)
      this.errorLogsService.logError({
        message: 'Failed to update user contract',
        stackTrace: (error as Error).stack ?? null,
        path: 'user-contracts',
      })
      throw error
    }
  }

  /**
   * Removes a contract by ID and syncs the user's contract fields.
   */
  async remove(id: number): Promise<void> {
    try {
      const contract = await this.userContractRepository.findOne({ where: { id } })
      if (!contract) throw new NotFoundException('Contract not found')

      const userId = contract.user_id
      await this.userContractRepository.delete({ id })
      await this.syncUserContractFields(userId)
    } catch (error) {
      this.logger.error('Failed to remove user contract', error)
      this.errorLogsService.logError({
        message: 'Failed to remove user contract',
        stackTrace: (error as Error).stack ?? null,
        path: 'user-contracts',
      })
      throw error
    }
  }

  /**
   * Recomputes contract_count on the user and mirrors the latest contract's fields.
   */
  private async syncUserContractFields(userId: number): Promise<void> {
    const count = await this.userContractRepository.count({ where: { user_id: userId } })

    const latestContract = await this.userContractRepository.findOne({
      where: { user_id: userId },
      order: { contract_number: 'DESC' },
    })

    await this.userRepository.update(
      { id: userId },
      {
        contract_count: count,
        contract_type: latestContract?.contract_type ?? null,
        contract_signed_date: latestContract?.signed_date ?? null,
        contract_expired_date: latestContract?.expired_date ?? null,
      },
    )
  }
}
