import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'
import { Meeting } from './meeting.entity'

export enum HostScheduleType {
  ONE_TIME = 'one_time',
  DATE_LIST = 'date_list',
  DATE_RANGE = 'date_range',
  RECURRING = 'recurring',
}

@Entity('meeting_host_schedules')
export class MeetingHostSchedule {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'meeting_id' })
  meeting_id!: number

  @ManyToOne(() => Meeting)
  @JoinColumn({ name: 'meeting_id' })
  meeting?: Meeting

  @Column({ name: 'user_id' })
  user_id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @Column({
    name: 'schedule_type',
    type: 'enum',
    enum: HostScheduleType,
  })
  schedule_type!: HostScheduleType

  /** one_time: the specific date (YYYY-MM-DD). */
  @Column({ name: 'date', type: 'date', nullable: true })
  date?: string

  /** date_list: array of specific dates (YYYY-MM-DD[]). */
  @Column({ name: 'dates', type: 'json', nullable: true })
  dates?: string[]

  /** date_range: start of range (YYYY-MM-DD). */
  @Column({ name: 'date_from', type: 'date', nullable: true })
  date_from?: string

  /** date_range: end of range inclusive (YYYY-MM-DD). */
  @Column({ name: 'date_to', type: 'date', nullable: true })
  date_to?: string

  /** recurring: 0=Sunday … 6=Saturday. */
  @Column({ name: 'day_of_week', type: 'tinyint', nullable: true })
  day_of_week?: number

  /** recurring: repeat every N weeks (1–4). */
  @Column({ name: 'interval_weeks', type: 'tinyint', nullable: true })
  interval_weeks?: number

  /** recurring: anchor date to calculate week offsets from (YYYY-MM-DD). */
  @Column({ name: 'recur_start_date', type: 'date', nullable: true })
  recur_start_date?: string

  /** recurring: optional end date — schedule stops after this date (YYYY-MM-DD). */
  @Column({ name: 'recur_end_date', type: 'date', nullable: true })
  recur_end_date?: string

  /** Dates explicitly excluded from this schedule (one-off overrides). */
  @Column({ name: 'excluded_dates', type: 'json', nullable: true })
  excluded_dates?: string[]

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active!: boolean

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date
}
