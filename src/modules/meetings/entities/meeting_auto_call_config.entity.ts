import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm'
import { Meeting } from './meeting.entity'

@Entity('meeting_auto_call_configs')
export class MeetingAutoCallConfig {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'meeting_id', unique: true })
  meeting_id!: number

  @OneToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting?: Meeting

  /** Minutes before scheduled_at to trigger the auto-call */
  @Column({ name: 'minutes_before', type: 'tinyint', unsigned: true, default: 5 })
  minutes_before!: number

  /** Number of retry attempts if participant does not answer (0 = no retry) */
  @Column({ name: 'retry_count', type: 'tinyint', unsigned: true, default: 0 })
  retry_count!: number

  /** Minutes between each retry attempt */
  @Column({ name: 'retry_interval_minutes', type: 'tinyint', unsigned: true, default: 2 })
  retry_interval_minutes!: number

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  is_enabled!: boolean

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date
}
