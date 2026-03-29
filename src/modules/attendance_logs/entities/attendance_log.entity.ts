import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'

export enum ScheduleType {
  COMPANY = 'company',
  CUSTOM = 'custom',
}

@Entity({ name: 'attendance_logs' })
@Unique('UQ_attendance_log_user_date', ['user_id', 'date'])
export class AttendanceLog {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, name: 'user_id' })
  user_id!: number

  @Column({ nullable: false, name: 'date', type: 'date' })
  date!: string

  @Column({ nullable: true, name: 'clock_in', type: 'time' })
  clock_in?: string | null

  @Column({ nullable: true, name: 'clock_out', type: 'time' })
  clock_out?: string | null

  @Column({
    nullable: true,
    name: 'scheduled_start',
    type: 'time',
    comment: 'Effective work start time for this user on this day',
  })
  scheduled_start?: string | null

  @Column({
    nullable: true,
    name: 'scheduled_end',
    type: 'time',
    comment: 'Effective work end time for this user on this day',
  })
  scheduled_end?: string | null

  @Column({
    nullable: true,
    name: 'schedule_type',
    type: 'enum',
    enum: ScheduleType,
    comment: 'Whether schedule came from company default or user custom',
  })
  schedule_type?: ScheduleType | null

  @Column({
    nullable: false,
    name: 'attendance_count',
    type: 'tinyint',
    default: 0,
    comment: '1 if user clocked in or out at any point that day, 0 otherwise',
  })
  attendance_count!: number

  @CreateDateColumn({ nullable: true, name: 'created_at', type: 'timestamp' })
  created_at?: Date

  @CreateDateColumn({ nullable: true, name: 'updated_at', type: 'timestamp' })
  updated_at?: Date

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User
}
