import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, LessThanOrEqual, IsNull, Or } from 'typeorm'
import { UserWorkSchedule } from './entities/user_work_schedule.entity'
import { CreateUserWorkScheduleDto } from './dto/create-user_work_schedule.dto'
import { UpdateUserWorkScheduleDto } from './dto/update-user_work_schedule.dto'

@Injectable()
export class UserWorkSchedulesService {
  constructor(
    @InjectRepository(UserWorkSchedule)
    private readonly userWorkScheduleRepository: Repository<UserWorkSchedule>,
  ) {}

  /**
   * Creates a new custom work schedule for a user.
   */
  async create(createDto: CreateUserWorkScheduleDto): Promise<UserWorkSchedule> {
    return this.userWorkScheduleRepository.save(createDto)
  }

  /**
   * Returns all custom schedules for a specific user, ordered by effective_from desc.
   */
  findByUser(userId: number): Promise<UserWorkSchedule[]> {
    return this.userWorkScheduleRepository.find({
      where: { user_id: userId },
      order: { effective_from: 'DESC' },
    })
  }

  /**
   * Returns a single schedule by ID.
   */
  async findOne(id: number): Promise<UserWorkSchedule> {
    const item = await this.userWorkScheduleRepository.findOne({ where: { id } })
    if (!item) throw new NotFoundException('User work schedule not found')
    return item
  }

  /**
   * Updates a schedule by ID.
   */
  async update(id: number, updateDto: UpdateUserWorkScheduleDto): Promise<UserWorkSchedule> {
    await this.userWorkScheduleRepository.update({ id }, { ...updateDto })
    return this.findOne(id)
  }

  /**
   * Deletes a schedule by ID.
   */
  async remove(id: number): Promise<void> {
    await this.userWorkScheduleRepository.delete({ id })
  }

  /**
   * Returns the active custom schedule for a user on a given date.
   * A schedule is active if effective_from <= date AND (effective_to >= date OR effective_to IS NULL).
   * Returns null if no custom schedule exists.
   */
  async findActiveForUser(userId: number, date: string): Promise<UserWorkSchedule | null> {
    const schedules = await this.userWorkScheduleRepository.find({
      where: {
        user_id: userId,
        effective_from: LessThanOrEqual(date),
        effective_to: Or(IsNull(), LessThanOrEqual('9999-12-31')),
      },
      order: { effective_from: 'DESC' },
    })

    // Filter effective_to >= date (or null = ongoing)
    const active = schedules.find(
      (schedule) => !schedule.effective_to || schedule.effective_to >= date,
    )
    return active ?? null
  }
}
