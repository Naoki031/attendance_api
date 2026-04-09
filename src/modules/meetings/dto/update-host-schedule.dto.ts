import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsArray, Min, Max } from 'class-validator'
import { HostScheduleType } from '../entities/meeting_host_schedule.entity'

export class UpdateHostScheduleDto {
  @IsOptional()
  @IsInt()
  user_id?: number

  @IsOptional()
  @IsEnum(HostScheduleType)
  schedule_type?: HostScheduleType

  @IsOptional()
  @IsString()
  date?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dates?: string[]

  @IsOptional()
  @IsString()
  date_from?: string

  @IsOptional()
  @IsString()
  date_to?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  interval_weeks?: number

  @IsOptional()
  @IsString()
  recur_start_date?: string

  @IsOptional()
  @IsString()
  recur_end_date?: string

  @IsOptional()
  @IsBoolean()
  is_active?: boolean
}
