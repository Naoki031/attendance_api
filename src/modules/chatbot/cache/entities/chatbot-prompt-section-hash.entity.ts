import { Entity, PrimaryGeneratedColumn, Column, Unique, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'chatbot_prompt_section_hashes' })
@Unique('UQ_section_id', ['sectionId'])
export class ChatbotPromptSectionHash {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'section_id', type: 'varchar', length: 100 })
  sectionId!: string

  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash!: string

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
