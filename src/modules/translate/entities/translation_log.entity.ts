import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('translation_logs')
export class TranslationLog {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'message_id', nullable: true })
  messageId?: number

  @Column({ length: 10 })
  sourceLang!: string

  @Column({ type: 'simple-json' })
  targetLangs!: string[]

  @Column({ name: 'input_length' })
  inputLength!: number

  @Column({ length: 20 })
  status!: 'success' | 'error' | 'partial'

  @Column({ type: 'text', nullable: true })
  errorMessage?: string

  @Column({ name: 'input_tokens', nullable: true })
  inputTokens?: number

  @Column({ name: 'output_tokens', nullable: true })
  outputTokens?: number

  @Column({ name: 'cache_creation_tokens', nullable: true })
  cacheCreationTokens?: number

  @Column({ name: 'cache_read_tokens', nullable: true })
  cacheReadTokens?: number

  @Column({ name: 'model_used', length: 50, nullable: true })
  modelUsed?: string

  @Column({ name: 'duration_ms', nullable: true })
  durationMs?: number

  @Column({ length: 10, nullable: true })
  mode?: 'sync' | 'stream'

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
