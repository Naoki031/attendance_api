import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export enum EventType {
  TEAM_BUILDING = 'team_building',
  BIRTHDAY = 'birthday',
  TRIP = 'trip',
  AWARD = 'award',
  LAUNCH = 'launch',
  OTHER = 'other',
}

export enum Privacy {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

@Entity({ name: 'memory_albums' })
export class MemoryAlbum {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 200 })
  title!: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ type: 'enum', enum: EventType, default: EventType.OTHER })
  eventType!: EventType

  @Column({ nullable: true })
  coverPhotoId?: string

  @Column({ type: 'date' })
  date!: string

  @Column({ type: 'enum', enum: Privacy, default: Privacy.PUBLIC })
  privacy!: Privacy

  @Column({ type: 'int' })
  createdById!: number

  @Column({ default: 0 })
  photoCount!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
