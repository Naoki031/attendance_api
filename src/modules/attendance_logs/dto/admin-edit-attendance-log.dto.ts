import { IsOptional, IsString, IsNotEmpty, Matches } from 'class-validator'

export class AdminEditAttendanceLogDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'clock_in must be in HH:MM or HH:MM:SS format' })
  clock_in?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'clock_out must be in HH:MM or HH:MM:SS format' })
  clock_out?: string

  @IsString()
  @IsNotEmpty()
  reason!: string
}
