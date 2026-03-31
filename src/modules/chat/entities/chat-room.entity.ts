import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
} from 'typeorm'
import { Expose } from 'class-transformer'
import { v4 as uuidv4 } from 'uuid'
import { User } from '@/modules/users/entities/user.entity'
import { ChatRoomMember } from './chat-room-member.entity'

export enum ChatRoomType {
  CHANNEL = 'channel',
  DIRECT = 'direct',
}

export enum ChatRoomVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

@Entity('chat_rooms')
export class ChatRoom {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'uuid', unique: true })
  uuid!: string

  @Column({ nullable: false, unique: true })
  name!: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({
    type: 'enum',
    enum: ChatRoomType,
    default: ChatRoomType.CHANNEL,
  })
  type!: ChatRoomType

  @Column({
    type: 'enum',
    enum: ChatRoomVisibility,
    default: ChatRoomVisibility.PUBLIC,
    name: 'visibility',
  })
  visibility!: ChatRoomVisibility

  @Column({ name: 'creator_id' })
  creator_id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator?: User

  @OneToMany(() => ChatRoomMember, (member) => member.room)
  members?: ChatRoomMember[]

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deleted_at: Date | null

  // Virtual field: the other user in a direct room (not persisted)
  @Expose()
  direct_user?: { id: number; full_name: string; email: string; avatar?: string } | null

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) {
      this.uuid = uuidv4()
    }
  }
}
