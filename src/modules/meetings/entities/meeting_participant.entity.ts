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

export enum MeetingParticipantRole {
  HOST = 'host',
  CO_HOST = 'co_host',
  PARTICIPANT = 'participant',
}

@Entity('meeting_participants')
@Unique('UQ_meeting_user', ['meeting_id', 'user_id'])
export class MeetingParticipant {
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
    type: 'enum',
    enum: MeetingParticipantRole,
    default: MeetingParticipantRole.PARTICIPANT,
  })
  role!: MeetingParticipantRole

  @CreateDateColumn({ name: 'joined_at' })
  joined_at: Date

  @Column({ name: 'left_at', type: 'timestamp', nullable: true })
  left_at?: Date
}
