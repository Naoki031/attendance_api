import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity({ name: 'memory_photos' })
export class MemoryPhoto {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  albumId!: string

  @Column({ length: 500 })
  url!: string

  @Column({ length: 500, nullable: true })
  thumbnailUrl?: string

  @Column({ type: 'text', nullable: true })
  caption?: string

  @Column({ type: 'int' })
  uploadedById!: number

  @Column({ nullable: true })
  width?: number

  @Column({ nullable: true })
  height?: number

  @Column({ type: 'bigint' })
  size!: number

  @Column({ length: 100 })
  mimeType!: string

  @CreateDateColumn()
  createdAt!: Date
}
