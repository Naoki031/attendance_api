import { IsDateString, IsNotEmpty } from 'class-validator'

export class TruncateScheduleDto {
  /** First date to remove. The schedule will no longer cover this date or any date after it. */
  @IsDateString()
  @IsNotEmpty()
  date!: string
}
