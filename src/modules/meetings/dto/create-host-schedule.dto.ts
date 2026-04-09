import { IsEnum, IsInt, IsOptional, IsString, IsArray, Min, Max, ValidateIf } from 'class-validator'
import { HostScheduleType } from '../entities/meeting_host_schedule.entity'

export class CreateHostScheduleDto {
  @IsInt()
  user_id!: number

  @IsEnum(HostScheduleType)
  schedule_type!: HostScheduleType

  /** one_time: YYYY-MM-DD */
  @ValidateIf((object) => object.schedule_type === HostScheduleType.ONE_TIME)
  @IsString()
  date?: string

  /** date_list: array of YYYY-MM-DD strings */
  @ValidateIf((object) => object.schedule_type === HostScheduleType.DATE_LIST)
  @IsArray()
  @IsString({ each: true })
  dates?: string[]

  /** date_range: start date YYYY-MM-DD */
  @ValidateIf((object) => object.schedule_type === HostScheduleType.DATE_RANGE)
  @IsString()
  date_from?: string

  /** date_range: end date YYYY-MM-DD */
  @ValidateIf((object) => object.schedule_type === HostScheduleType.DATE_RANGE)
  @IsString()
  date_to?: string

  /** recurring: 0=Sunday … 6=Saturday */
  @ValidateIf((object) => object.schedule_type === HostScheduleType.RECURRING)
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week?: number

  /** recurring: every N weeks (1–4) */
  @ValidateIf((object) => object.schedule_type === HostScheduleType.RECURRING)
  @IsInt()
  @Min(1)
  @Max(4)
  interval_weeks?: number

  /** recurring: anchor date YYYY-MM-DD */
  @ValidateIf((object) => object.schedule_type === HostScheduleType.RECURRING)
  @IsString()
  recur_start_date?: string

  /** recurring: optional end date YYYY-MM-DD */
  @IsOptional()
  @IsString()
  recur_end_date?: string
}
