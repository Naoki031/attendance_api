import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'user_id' })
  user_id!: number

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User

  @Column({ length: 50 })
  type!: string

  @Column({ length: 255 })
  title!: string

  @Column({ type: 'text', nullable: true })
  body?: string

  @Column({ length: 80, nullable: true })
  icon?: string

  @Column({ length: 30, nullable: true })
  icon_color?: string

  @Column({ length: 500, nullable: true })
  route?: string

  @Column({ type: 'json', nullable: true })
  data?: Record<string, unknown>

  @Column({ name: 'is_read', type: 'tinyint', default: 0 })
  is_read!: boolean

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  read_at?: Date

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date
}
