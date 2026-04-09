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
import { Meeting } from './meeting.entity'

@Entity('meeting_pins')
@Unique(['user_id', 'meeting_id'])
export class MeetingPin {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false })
  user_id!: number

  @Column({ nullable: false })
  meeting_id!: number

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting?: Meeting
}
