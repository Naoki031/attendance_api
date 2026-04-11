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
import { Exclude } from 'class-transformer'
import { User } from '@/modules/users/entities/user.entity'
import { Meeting } from './meeting.entity'

export enum ScheduledParticipantStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

@Entity('meeting_scheduled_participants')
@Unique('UQ_msp_meeting_user', ['meeting_id', 'user_id'])
export class MeetingScheduledParticipant {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'meeting_id' })
  meeting_id!: number

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting?: Meeting

  @Column({ name: 'user_id' })
  user_id!: number

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User

  @Column({ name: 'invited_by' })
  invited_by!: number

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by' })
  inviter?: User

  @Column({
    type: 'enum',
    enum: ScheduledParticipantStatus,
    default: ScheduledParticipantStatus.PENDING,
  })
  status!: ScheduledParticipantStatus

  /**
   * Opaque token embedded in email links for @Public() RSVP without login.
   * Single-use — cleared after the user responds. Never returned in API responses.
   */
  @Exclude()
  @Column({ name: 'rsvp_token', type: 'varchar', length: 64, unique: true, nullable: true })
  rsvp_token?: string | null

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date
}
