import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  Min,
  Max,
} from 'class-validator'
import { MeetingType } from '../entities/meeting.entity'

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(MeetingType)
  meeting_type?: MeetingType

  @IsOptional()
  @IsDateString()
  scheduled_at?: string

  @IsOptional()
  @IsBoolean()
  is_private?: boolean

  @IsOptional()
  @IsString()
  password?: string

  @IsOptional()
  @IsString()
  schedule_time?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  schedule_day_of_week?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  schedule_interval_weeks?: number

  /** Replace the full list of company IDs this meeting is scoped to. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  company_ids?: number[]
}
