import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm'

@Entity({ name: 'memory_album_views' })
@Unique(['albumId', 'userId'])
export class MemoryAlbumView {
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  albumId!: string

  @Column({ type: 'int' })
  userId!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
