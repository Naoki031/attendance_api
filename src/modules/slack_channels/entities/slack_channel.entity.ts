import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Exclude } from 'class-transformer'
import { Company } from '@/modules/companies/entities/company.entity'
import type { User } from '@/modules/users/entities/user.entity'

export enum SlackChannelFeature {
  WFH = 'wfh',
  OFF = 'off',
  EQUIPMENT = 'equipment',
  CLOCK_FORGET = 'clock_forget',
  OVERTIME = 'overtime',
  ERROR = 'error',
}

@Entity({ name: 'slack_channels' })
export class SlackChannel {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: true, name: 'company_id' })
  company_id?: number

  @Column({ nullable: false })
  name!: string

  @Exclude()
  @Column({ nullable: false, name: 'webhook_url', length: 500 })
  webhook_url!: string

  @Column({ nullable: true, name: 'channel_id', length: 50 })
  channel_id?: string

  @Column({ type: 'enum', enum: SlackChannelFeature, nullable: false })
  feature!: SlackChannelFeature

  @Column({ type: 'json', nullable: true, name: 'mention_user_ids' })
  mention_user_ids?: number[]

  @Column({
    type: 'json',
    nullable: true,
    name: 'mention_slack_group_handles',
    comment:
      'Slack group handles to mention, e.g. ["here", "channel"] or subteam IDs like ["S1234567"]',
  })
  mention_slack_group_handles?: string[]

  @Column({ type: 'text', nullable: true, name: 'message_template' })
  message_template?: string

  @Column({ type: 'boolean', default: false, name: 'include_approval_link' })
  include_approval_link!: boolean

  @Column({ type: 'boolean', default: false, name: 'include_my_requests_link' })
  include_my_requests_link!: boolean

  /** Populated at runtime from mention_user_ids — not persisted */
  mention_users?: User[]

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @CreateDateColumn({ nullable: true, name: 'updated_at' })
  updated_at?: Date

  @CreateDateColumn({ nullable: true, name: 'deleted_at' })
  deleted_at?: Date
}
