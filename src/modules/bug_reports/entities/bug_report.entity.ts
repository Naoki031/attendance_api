import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'

export enum BugReportStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
}

@Entity({ name: 'bug_reports' })
export class BugReport {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, name: 'user_id' })
  user_id!: number

  @Column({ nullable: false, type: 'varchar', length: 255 })
  title!: string

  @Column({ nullable: true, type: 'text' })
  description?: string

  @Column({ nullable: true, type: 'varchar', length: 500 })
  screenshot_path?: string

  @Column({
    type: 'enum',
    enum: BugReportStatus,
    default: BugReportStatus.PENDING,
    nullable: false,
  })
  status!: BugReportStatus

  @Column({ nullable: true, type: 'text', name: 'admin_note' })
  admin_note?: string

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @CreateDateColumn({ nullable: true, name: 'updated_at' })
  updated_at?: Date

  @CreateDateColumn({ nullable: true, name: 'deleted_at' })
  deleted_at?: Date
}
