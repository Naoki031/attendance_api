import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'
import { ChatRoom } from './chat-room.entity'
import { User } from '@/modules/users/entities/user.entity'

export enum ChatRoomMemberRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity('chat_room_members')
@Unique(['room_id', 'user_id'])
export class ChatRoomMember {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'room_id' })
  room_id!: number

  @Column({ name: 'user_id' })
  user_id!: number

  @Column({
    type: 'enum',
    enum: ChatRoomMemberRole,
    default: ChatRoomMemberRole.MEMBER,
  })
  role!: ChatRoomMemberRole

  @ManyToOne(() => ChatRoom, (room) => room.members)
  @JoinColumn({ name: 'room_id' })
  room?: ChatRoom

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @Column({ name: 'last_read_at', type: 'datetime', nullable: true, default: null })
  last_read_at: Date | null

  @CreateDateColumn({ name: 'joined_at' })
  joined_at: Date
}
