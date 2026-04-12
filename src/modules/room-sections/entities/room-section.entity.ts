import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'
import { RoomSectionItem } from './room-section-item.entity'

@Entity('room_sections')
export class RoomSection {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false })
  user_id!: number

  @Column({ nullable: false, length: 100 })
  name!: string

  @Column({ nullable: false, default: 0 })
  position!: number

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @UpdateDateColumn({ nullable: true, name: 'updated_at' })
  updated_at?: Date

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User

  @OneToMany(() => RoomSectionItem, (item) => item.section, { cascade: true, eager: true })
  items?: RoomSectionItem[]
}
