import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'
import { Department } from '@/modules/departments/entities/department.entity'
import { Company } from '@/modules/companies/entities/company.entity'

@Entity({ name: 'user_departments' })
export class UserDepartment {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, name: 'user_id' })
  user_id!: number

  @Column({ nullable: false, name: 'company_id' })
  company_id!: number

  @Column({ nullable: false, name: 'department_id' })
  department_id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department?: Department

  @CreateDateColumn({ nullable: false, name: 'created_at' })
  created_at?: Date

  @CreateDateColumn({ nullable: false, name: 'updated_at' })
  updated_at?: Date
}
