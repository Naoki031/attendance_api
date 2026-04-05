import { IsOptional, IsString, IsEnum } from 'class-validator'
import { MeetingStatus } from '../entities/meeting.entity'

export class FilterMeetingDto {
  @IsOptional()
  @IsEnum(MeetingStatus)
  status?: MeetingStatus

  @IsOptional()
  @IsString()
  search?: string
}
