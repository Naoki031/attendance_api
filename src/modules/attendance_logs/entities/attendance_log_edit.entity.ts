import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { AttendanceLog } from './attendance_log.entity'
import { User } from '@/modules/users/entities/user.entity'

@Entity({ name: 'attendance_log_edits' })
export class AttendanceLogEdit {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, name: 'attendance_log_id' })
  attendance_log_id!: number

  @Column({ nullable: false, name: 'admin_id' })
  admin_id!: number

  @Column({ nullable: true, name: 'old_clock_in', type: 'time' })
  old_clock_in?: string | null

  @Column({ nullable: true, name: 'new_clock_in', type: 'time' })
  new_clock_in?: string | null

  @Column({ nullable: true, name: 'old_clock_out', type: 'time' })
  old_clock_out?: string | null

  @Column({ nullable: true, name: 'new_clock_out', type: 'time' })
  new_clock_out?: string | null

  @Column({ nullable: false, name: 'reason', type: 'text' })
  reason!: string

  @CreateDateColumn({ nullable: true, name: 'created_at', type: 'timestamp' })
  created_at?: Date

  @ManyToOne(() => AttendanceLog)
  @JoinColumn({ name: 'attendance_log_id' })
  attendance_log?: AttendanceLog

  @ManyToOne(() => User)
  @JoinColumn({ name: 'admin_id' })
  admin?: User
}
