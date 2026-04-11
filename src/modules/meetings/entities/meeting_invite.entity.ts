import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'
import { Meeting } from './meeting.entity'

export enum MeetingInviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  MAYBE = 'maybe',
  MISSED = 'missed',
}

@Entity('meeting_invites')
@Unique('UQ_meeting_invite_user', ['meeting_id', 'user_id'])
export class MeetingInvite {
  @PrimaryGeneratedColumn()
  id!: number

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

  @Column({ name: 'invited_by' })
  invited_by!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'invited_by' })
  inviter?: User

  @Column({
    type: 'enum',
    enum: MeetingInviteStatus,
    default: MeetingInviteStatus.PENDING,
  })
  status!: MeetingInviteStatus

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date
}
