import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsDateString,
  IsArray,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import {
  EmployeeRequestType,
  LeaveType,
  ClockType,
  OvertimeType,
} from '../entities/employee_request.entity'

export class CreateEmployeeRequestDto {
  @IsEnum(EmployeeRequestType)
  @IsNotEmpty()
  type!: EmployeeRequestType

  // Shared
  @IsDateString()
  @IsOptional()
  from_datetime?: string

  @IsDateString()
  @IsOptional()
  to_datetime?: string

  @IsString()
  @IsOptional()
  reason?: string

  @IsArray()
  @IsOptional()
  cc_user_ids?: number[]

  @IsString()
  @IsOptional()
  note?: string

  // OFF-specific
  @IsEnum(LeaveType)
  @IsOptional()
  leave_type?: LeaveType

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.5)
  @IsOptional()
  unit_hours?: number

  // Equipment-specific
  @IsString()
  @IsOptional()
  equipment_name?: string

  @IsString()
  @IsOptional()
  location?: string

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number

  // Clock forget-specific
  @IsEnum(ClockType)
  @IsOptional()
  clock_type?: ClockType

  @IsString()
  @IsOptional()
  forget_date?: string

  // Overtime-specific
  @IsEnum(OvertimeType)
  @IsOptional()
  overtime_type?: OvertimeType

  // Business trip-specific
  @IsString()
  @IsOptional()
  trip_destination?: string
}
