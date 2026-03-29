import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Group } from './group.entity'
import { User } from '@/modules/users/entities/user.entity'

@Entity({ name: 'user_groups' })
export class UserGroup {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, name: 'user_id' })
  user_id!: number

  @Column({ nullable: false, name: 'group_id' })
  group_id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @ManyToOne(() => Group)
  @JoinColumn({ name: 'group_id' })
  group?: Group

  @CreateDateColumn({ nullable: false, name: 'created_at' })
  created_at?: Date

  @CreateDateColumn({ nullable: false, name: 'updated_at' })
  updated_at?: Date
}
