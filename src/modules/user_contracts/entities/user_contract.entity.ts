import moment from 'moment'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'

const dateTransformer = {
  to: (value: string | null | undefined) => value ?? null,
  from: (value: Date | string | null | undefined) => {
    if (!value) return null
    if (value instanceof Date) return moment.utc(value).format('YYYY-MM-DD')
    return String(value).slice(0, 10)
  },
}

@Entity({ name: 'user_contracts' })
export class UserContract {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({
    nullable: false,
    name: 'user_id',
  })
  user_id!: number

  @Column({
    nullable: false,
    name: 'contract_number',
    comment: 'Sequential contract number for this user (1, 2, 3...)',
  })
  contract_number!: number

  @Column({
    nullable: false,
    name: 'contract_type',
    comment: 'Contract type: probation | fixed_term | indefinite',
  })
  contract_type!: string

  @Column({
    type: 'date',
    nullable: false,
    name: 'signed_date',
    transformer: dateTransformer,
  })
  signed_date!: string

  @Column({
    type: 'date',
    nullable: true,
    name: 'expired_date',
    comment: 'NULL for indefinite contracts',
    transformer: dateTransformer,
  })
  expired_date?: string | null

  @Column({
    type: 'text',
    nullable: true,
    name: 'notes',
  })
  notes?: string | null

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @CreateDateColumn({
    nullable: true,
    name: 'created_at',
  })
  created_at?: Date

  @UpdateDateColumn({
    nullable: true,
    name: 'updated_at',
  })
  updated_at?: Date
}
