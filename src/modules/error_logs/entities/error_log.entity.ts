import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

export type ErrorLogLevel = 'error' | 'warn' | 'fatal'

@Entity('error_logs')
export class ErrorLog {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ length: 20, default: 'error' })
  level!: ErrorLogLevel

  @Column({ length: 500 })
  message!: string

  @Column({ type: 'text', nullable: true })
  stack_trace?: string

  @Column({ name: 'status_code', nullable: true })
  status_code?: number

  @Column({ length: 500, nullable: true })
  path?: string

  @Column({ length: 10, nullable: true })
  method?: string

  @Column({ type: 'text', name: 'request_body', nullable: true })
  request_body?: string

  @Column({ length: 1000, name: 'request_query', nullable: true })
  request_query?: string

  @Column({ type: 'text', name: 'request_headers', nullable: true })
  request_headers?: string

  @Column({ name: 'user_id', nullable: true })
  user_id?: number

  @Column({ name: 'user_email', length: 255, nullable: true })
  user_email?: string

  @Column({ name: 'user_name', length: 255, nullable: true })
  user_name?: string

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ip_address?: string

  @Column({ name: 'user_agent', length: 500, nullable: true })
  user_agent?: string

  @Column({ name: 'is_resolved', default: false })
  is_resolved!: boolean

  @Column({ name: 'resolved_by', nullable: true })
  resolved_by?: number

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolved_at?: Date

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date
}
