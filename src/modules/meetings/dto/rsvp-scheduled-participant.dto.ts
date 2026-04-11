import { IsIn } from 'class-validator'
import { ScheduledParticipantStatus } from '../entities/meeting_scheduled_participant.entity'

export class RsvpScheduledParticipantDto {
  @IsIn([ScheduledParticipantStatus.ACCEPTED, ScheduledParticipantStatus.DECLINED])
  status!: ScheduledParticipantStatus
}
