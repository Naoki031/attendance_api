import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm'

@Entity({ name: 'memory_photo_views' })
@Unique(['photoId', 'userId'])
export class MemoryPhotoView {
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  photoId!: string

  @Column({ type: 'int' })
  userId!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
