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

export class CreateMeetingDto {
  @IsString()
  title!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsDateString()
  scheduled_at?: string

  @IsOptional()
  @IsBoolean()
  is_private?: boolean

  @IsOptional()
  @IsEnum(MeetingType)
  meeting_type?: MeetingType

  /** Plain-text password provided by the client; hashed before storage. */
  @IsOptional()
  @IsString()
  password?: string

  /** Time of day for daily/weekly schedules in HH:mm format (e.g. "09:00"). */
  @IsOptional()
  @IsString()
  schedule_time?: string

  /** Day of week for weekly schedules: 0 = Sunday, 6 = Saturday. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  schedule_day_of_week?: number

  /** Recurrence interval in weeks for weekly schedules (1–4). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  schedule_interval_weeks?: number

  /**
   * Company IDs this meeting is scoped to. Defaults to the creator's company if not provided.
   * Only users belonging to one of these companies can see this meeting.
   */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  company_ids?: number[]
}
