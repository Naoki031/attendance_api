import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm'

export enum ReactionType {
  HEART = 'heart',
  CARE = 'care',
  LAUGH = 'laugh',
  WOW = 'wow',
  ANGRY = 'angry',
  SAD = 'sad',
}

@Entity({ name: 'memory_reactions' })
@Unique(['photoId', 'userId'])
export class MemoryReaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  photoId!: string

  @Column({ type: 'int' })
  userId!: number

  @Column({ type: 'enum', enum: ReactionType })
  type!: ReactionType

  @CreateDateColumn()
  createdAt!: Date
}
