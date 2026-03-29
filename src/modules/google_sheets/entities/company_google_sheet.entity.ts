import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'
import { Company } from '@/modules/companies/entities/company.entity'

export interface ColumnConfigItem {
  column: string // Spreadsheet column letter, e.g. "A", "B", "AA"
  field: string // Data field path, e.g. "id", "user.email", "from_datetime"
  header: string // Column header label shown in the sheet
}

/** Sentinel value meaning "applies to all request types" */
export const REQUEST_TYPE_ALL = 'all'

@Entity({ name: 'company_google_sheets' })
@Unique('UQ_company_request_type', ['company_id', 'request_type'])
export class CompanyGoogleSheet {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, name: 'company_id' })
  company_id!: number

  /**
   * The request type this config applies to.
   * 'all' = applies to every request type (default fallback).
   * Other values: 'wfh', 'off', 'equipment', 'clock_forget', 'overtime'
   */
  @Column({ nullable: false, name: 'request_type', length: 50, default: REQUEST_TYPE_ALL })
  request_type!: string

  @Column({ nullable: false, name: 'spreadsheet_id', length: 255 })
  spreadsheet_id!: string

  @Column({ nullable: false, name: 'sheet_name', length: 100, default: 'Leave Requests' })
  sheet_name!: string

  /**
   * JSON array of column mappings.
   * Each item: { column: 'A', field: 'user.email', header: 'Email' }
   * Null = use the built-in default column layout.
   */
  @Column({ nullable: true, name: 'column_config', type: 'json' })
  column_config?: ColumnConfigItem[] | null

  @Column({ nullable: false, name: 'is_active', default: true })
  is_active!: boolean

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @UpdateDateColumn({ nullable: true, name: 'updated_at' })
  updated_at?: Date
}
