import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'memory_album_comments' })
export class MemoryAlbumComment {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  albumId!: string

  @Column({ type: 'int' })
  userId!: number

  @Column({ type: 'text' })
  text!: string

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'detected_language', default: null })
  detectedLanguage?: string | null

  @Column({ type: 'json', nullable: true, name: 'reactions', default: null })
  reactions?: Record<string, Array<{ id: number; name: string }>> | null

  @Column({ type: 'json', nullable: true, name: 'translations', default: null })
  translations?: Record<string, string> | null

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
