import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'
import { RoomSection } from './room-section.entity'

export type RoomSectionResourceType = 'meeting' | 'chat_room'

@Entity('room_section_items')
@Unique(['section_id', 'resource_type', 'resource_id'])
export class RoomSectionItem {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false })
  section_id!: number

  @Column({ nullable: false, type: 'enum', enum: ['meeting', 'chat_room'] })
  resource_type!: RoomSectionResourceType

  @Column({ nullable: false })
  resource_id!: number

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @ManyToOne(() => RoomSection, (section) => section.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section?: RoomSection
}
