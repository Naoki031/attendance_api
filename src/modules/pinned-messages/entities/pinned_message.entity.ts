import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { Message } from '@/modules/messages/entities/message.entity'
import { User } from '@/modules/users/entities/user.entity'
import { ChatRoom } from '@/modules/chat/entities/chat-room.entity'

@Entity('pinned_messages')
export class PinnedMessage {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'room_id' })
  room_id!: number

  @Column({ name: 'message_id' })
  message_id!: number

  @Column({ name: 'pinned_by_user_id' })
  pinned_by_user_id!: number

  @ManyToOne(() => ChatRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room?: ChatRoom

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message?: Message

  @ManyToOne(() => User)
  @JoinColumn({ name: 'pinned_by_user_id' })
  pinned_by?: User

  @Column({ name: 'created_at', type: 'datetime' })
  created_at!: Date
}
