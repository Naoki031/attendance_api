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

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'room_id' })
  room_id: number

  @Column({ name: 'user_id' })
  user_id: number

  @Column({ type: 'text' })
  content: string

  @Column({ name: 'detected_lang', nullable: true })
  detected_lang?: string

  @Column({ name: 'is_edited', default: false })
  is_edited: boolean

  @Column({ name: 'previous_content', type: 'text', nullable: true })
  previous_content?: string

  @Column({ name: 'parent_id', nullable: true })
  parent_id: number | null

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Message | null

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date
}
