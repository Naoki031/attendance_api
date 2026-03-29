import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm'
import { Company } from '@/modules/companies/entities/company.entity'
import { User } from '@/modules/users/entities/user.entity'

@Entity({ name: 'company_approvers' })
export class CompanyApprover {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, name: 'company_id' })
  company_id!: number

  @Column({ nullable: false, name: 'user_id' })
  user_id!: number

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date
}
