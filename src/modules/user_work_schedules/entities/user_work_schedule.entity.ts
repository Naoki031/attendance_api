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

@Entity({ name: 'user_work_schedules' })
export class UserWorkSchedule {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, name: 'user_id' })
  user_id!: number

  @Column({
    nullable: false,
    name: 'start_time',
    type: 'time',
    comment: 'Custom work start time for this user',
  })
  start_time!: string

  @Column({
    nullable: false,
    name: 'end_time',
    type: 'time',
    comment: 'Custom work end time for this user',
  })
  end_time!: string

  @Column({
    nullable: false,
    name: 'effective_from',
    type: 'date',
    comment: 'Date from which this schedule is effective',
  })
  effective_from!: string

  @Column({
    nullable: true,
    name: 'effective_to',
    type: 'date',
    comment: 'Date until which this schedule is effective, null = ongoing',
  })
  effective_to?: string | null

  @Column({
    nullable: true,
    name: 'note',
    type: 'text',
    comment: 'Reason or note for the custom schedule',
  })
  note?: string | null

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @UpdateDateColumn({ nullable: true, name: 'updated_at' })
  updated_at?: Date

  @CreateDateColumn({ nullable: true, name: 'deleted_at' })
  deleted_at?: Date
}
