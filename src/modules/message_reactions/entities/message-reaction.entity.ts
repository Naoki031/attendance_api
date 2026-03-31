import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'
import { Message } from '@/modules/messages/entities/message.entity'
import { User } from '@/modules/users/entities/user.entity'

@Entity('message_reactions')
@Unique(['message_id', 'user_id'])
export class MessageReaction {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'message_id' })
  message_id: number

  @Column({ name: 'user_id' })
  user_id: number

  @Column({ length: 20 })
  emoji: string

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message?: Message

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date
}
