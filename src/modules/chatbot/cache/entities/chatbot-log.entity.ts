import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('chatbot_logs')
export class ChatbotLog {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'query_hash', type: 'varchar', length: 64, nullable: true })
  queryHash?: string

  @Column({ length: 10 })
  role!: string

  @Column({ length: 20 })
  tone!: string

  @Column({ length: 10, nullable: true })
  language?: string

  @Column({ length: 20 })
  status!: 'cache_hit' | 'cache_miss' | 'error' | 'rejected'

  @Column({ name: 'input_tokens', nullable: true })
  inputTokens?: number

  @Column({ name: 'output_tokens', nullable: true })
  outputTokens?: number

  @Column({ name: 'cache_lookup_ms', nullable: true })
  cacheLookupMs?: number

  @Column({ name: 'api_call_ms', nullable: true })
  apiCallMs?: number

  @Column({ name: 'model_used', length: 50, nullable: true })
  modelUsed?: string

  @Column({ type: 'text', nullable: true })
  errorMessage?: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
