import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm'

@Entity({ name: 'chatbot_cache_entries' })
@Unique('UQ_cache_hash_role_tone', ['queryHash', 'role', 'tone'])
@Index('IDX_cache_expires', ['expiresAt'])
export class ChatbotCacheEntry {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'query_hash', type: 'varchar', length: 64 })
  queryHash!: string

  @Column({ name: 'original_query', type: 'text' })
  originalQuery!: string

  @Column({ name: 'normalized_query', type: 'text' })
  normalizedQuery!: string

  @Column({ type: 'varchar', length: 10 })
  role!: string

  @Column({ type: 'varchar', length: 20 })
  tone!: string

  @Column({ type: 'varchar', length: 10, nullable: true })
  language!: string | null

  @Column({ type: 'text' })
  reply!: string

  @Column({ type: 'json' })
  suggestions!: string[]

  @Column({ name: 'section_ids', type: 'json' })
  sectionIds!: string[]

  @Column({ name: 'model_used', type: 'varchar', length: 50 })
  modelUsed!: string

  @Column({ name: 'hit_count', type: 'int', default: 1 })
  hitCount!: number

  @Column({ name: 'last_hit_at', type: 'timestamp', nullable: true })
  lastHitAt!: Date | null

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
