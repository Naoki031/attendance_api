import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('translation_cache')
export class TranslationCache {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'message_id', unique: true })
  messageId: number

  @Column({ type: 'json' })
  translations: Record<string, string>

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
