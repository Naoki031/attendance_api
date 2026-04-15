import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Company } from '@/modules/companies/entities/company.entity'

@Entity({ name: 'email_templates' })
export class EmailTemplate {
  @PrimaryGeneratedColumn()
  id!: number

  /** Template identifier — e.g. 'meeting_invite_rsvp'. Unique per company scope. */
  @Column({ length: 100 })
  key!: string

  @Column({ length: 255 })
  subject!: string

  @Column({ type: 'text' })
  body_html!: string

  @Column({ length: 500, nullable: true })
  description?: string

  /** Available {{variable}} names for this template. */
  @Column({ type: 'json', nullable: true })
  variables?: string[]

  /** System templates are seeded defaults — they can be edited but not deleted. */
  @Column({ default: false })
  is_system!: boolean

  /**
   * Company ID — when null this is a global default template.
   * Company-specific templates override global ones with the same key.
   */
  @Column({ name: 'company_id', nullable: true })
  company_id?: number | null

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date

  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date
}
