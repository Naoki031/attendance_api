import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
} from 'typeorm'
import { Exclude } from 'class-transformer'
import { v4 as uuidv4 } from 'uuid'
import { User } from '@/modules/users/entities/user.entity'
import { MeetingParticipant } from './meeting_participant.entity'
import { MeetingPin } from './meeting_pin.entity'
import { MeetingCompany } from './meeting_company.entity'

export enum MeetingStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
}

export enum MeetingType {
  ONE_TIME = 'one_time',
  RECURRING = 'recurring',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'uuid', unique: true })
  uuid!: string

  @Column({ nullable: false })
  title!: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ name: 'host_id' })
  host_id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'host_id' })
  host?: User

  @Column({
    type: 'enum',
    enum: MeetingStatus,
    default: MeetingStatus.SCHEDULED,
  })
  status!: MeetingStatus

  @Column({
    name: 'meeting_type',
    type: 'enum',
    enum: MeetingType,
    default: MeetingType.ONE_TIME,
  })
  meeting_type!: MeetingType

  @Column({ name: 'livekit_room_name', nullable: false, unique: true })
  livekit_room_name!: string

  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduled_at?: Date

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  started_at?: Date

  /** Time of day for recurring schedules (HH:mm, e.g. "09:00"). */
  @Column({ name: 'schedule_time', type: 'varchar', length: 5, nullable: true })
  schedule_time?: string

  /** Day of week for weekly schedules (0=Sunday, 6=Saturday). */
  @Column({ name: 'schedule_day_of_week', type: 'tinyint', nullable: true })
  schedule_day_of_week?: number

  /** Recurrence interval in weeks for weekly schedules (1–4). */
  @Column({ name: 'schedule_interval_weeks', type: 'tinyint', nullable: true })
  schedule_interval_weeks?: number

  @Column({ name: 'is_private', type: 'boolean', default: false })
  is_private!: boolean

  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', length: '255', nullable: true })
  password_hash?: string

  @OneToMany(() => MeetingParticipant, (participant) => participant.meeting)
  participants?: MeetingParticipant[]

  @OneToMany(() => MeetingPin, (pin) => pin.meeting)
  pins?: MeetingPin[]

  @OneToMany(() => MeetingCompany, (meetingCompany) => meetingCompany.meeting)
  meeting_companies?: MeetingCompany[]

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) {
      this.uuid = uuidv4()
    }
  }
}
