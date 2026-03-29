import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'

export enum EmployeeRequestType {
  WFH = 'wfh',
  OFF = 'off',
  EQUIPMENT = 'equipment',
  CLOCK_FORGET = 'clock_forget',
  OVERTIME = 'overtime',
}

export enum EmployeeRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum LeaveType {
  PAID_LEAVE = 'paid_leave',
  UNPAID_LEAVE = 'unpaid_leave',
  WOMAN_LEAVE = 'woman_leave',
  MARRIAGE_LEAVE = 'marriage_leave',
  MATERNITY_LEAVE = 'maternity_leave',
  PATERNITY_LEAVE = 'paternity_leave',
  COMPASSIONATE_LEAVE = 'compassionate_leave',
}

export enum ClockType {
  CLOCK_IN = 'clock_in',
  CLOCK_OUT = 'clock_out',
}

export enum OvertimeType {
  WEEKDAY = 'weekday',
  WEEKEND = 'weekend',
  PUBLIC_HOLIDAY = 'public_holiday',
}

@Entity({ name: 'employee_requests' })
export class EmployeeRequest {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, name: 'user_id' })
  user_id!: number

  @Column({ nullable: true, name: 'approver_id' })
  approver_id?: number

  @Column({ type: 'enum', enum: EmployeeRequestType, nullable: false })
  type!: EmployeeRequestType

  @Column({
    type: 'enum',
    enum: EmployeeRequestStatus,
    default: EmployeeRequestStatus.PENDING,
    nullable: false,
  })
  status!: EmployeeRequestStatus

  // Shared fields (WFH / OFF)
  @Column({ nullable: true, name: 'from_datetime', type: 'datetime' })
  from_datetime?: Date

  @Column({ nullable: true, name: 'to_datetime', type: 'datetime' })
  to_datetime?: Date

  @Column({ nullable: true, type: 'text' })
  reason?: string

  @Column({ nullable: true, name: 'cc_user_ids', type: 'json' })
  cc_user_ids?: number[]

  @Column({ nullable: true, type: 'text' })
  note?: string

  @Column({ nullable: true, name: 'approver_note', type: 'text' })
  approver_note?: string

  // OFF-specific fields
  @Column({ type: 'enum', enum: LeaveType, nullable: true, name: 'leave_type' })
  leave_type?: LeaveType

  @Column({ nullable: true, name: 'unit_hours', type: 'decimal', precision: 5, scale: 2 })
  unit_hours?: number

  // Equipment-specific fields
  @Column({ nullable: true, name: 'equipment_name', length: 255 })
  equipment_name?: string

  @Column({ nullable: true, length: 255 })
  location?: string

  @Column({ nullable: true, type: 'int' })
  quantity?: number

  // Clock forget-specific fields
  @Column({ type: 'enum', enum: ClockType, nullable: true, name: 'clock_type' })
  clock_type?: ClockType

  @Column({ nullable: true, name: 'forget_date', type: 'date' })
  forget_date?: string

  // Overtime-specific fields
  @Column({ type: 'enum', enum: OvertimeType, nullable: true, name: 'overtime_type' })
  overtime_type?: OvertimeType

  /** Row index in Google Sheet — set after appending, used to update on approval */
  @Column({ nullable: true, name: 'sheet_row_index', type: 'int' })
  sheet_row_index?: number

  /** Comma-separated Google Calendar event IDs — one per weekday when range request */
  @Column({ nullable: true, name: 'calendar_event_id', type: 'text' })
  calendar_event_id?: string

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approver_id' })
  approver?: User

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @CreateDateColumn({ nullable: true, name: 'updated_at' })
  updated_at?: Date

  @CreateDateColumn({ nullable: true, name: 'deleted_at' })
  deleted_at?: Date
}
