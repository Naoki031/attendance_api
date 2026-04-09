import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm'
import { Meeting } from './meeting.entity'
import { Company } from '@/modules/companies/entities/company.entity'

@Entity('meeting_companies')
@Unique(['meeting_id', 'company_id'])
export class MeetingCompany {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false })
  meeting_id!: number

  @Column({ nullable: false })
  company_id!: number

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting?: Meeting

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company
}
