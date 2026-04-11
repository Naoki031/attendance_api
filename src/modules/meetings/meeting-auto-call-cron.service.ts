import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { MeetingScheduledParticipantsService } from './meeting-scheduled-participants.service'
import { MeetingsGateway } from './meetings.gateway'

/**
 * Runs every minute to fire auto-call invites for scheduled meeting participants.
 * Uses a +/- 5-second window around the trigger time to handle slight timing drift.
 *
 * Auto-call ID convention: msp.id + 100_000_000
 * — ensures no collision with real MeetingInvite IDs in the gateway timeout map.
 */
@Injectable()
export class MeetingAutoCallCronService {
  private readonly logger = new Logger(MeetingAutoCallCronService.name)

  constructor(
    private readonly scheduledParticipantsService: MeetingScheduledParticipantsService,
    private readonly meetingsGateway: MeetingsGateway,
  ) {}

  @Cron('* * * * *')
  async handleAutoCall(): Promise<void> {
    await this.fireInitialCalls()
    await this.fireRetryCalls()
  }

  /**
   * Fires the first auto-call for each upcoming meeting.
   */
  private async fireInitialCalls(): Promise<void> {
    let targets: Awaited<
      ReturnType<typeof this.scheduledParticipantsService.findUpcomingAutoCallTargets>
    >
    try {
      targets = await this.scheduledParticipantsService.findUpcomingAutoCallTargets()
    } catch (error) {
      this.logger.error('Failed to load auto-call targets', (error as Error).message)
      return
    }

    for (const { meeting, participants } of targets) {
      const activeUserIds = this.meetingsGateway.getActiveUserIds(meeting.id)

      for (const participant of participants) {
        if (activeUserIds.has(participant.user_id)) {
          this.logger.log(
            `Auto-call skipped: user ${participant.user_id} already in meeting ${meeting.uuid}`,
          )
          continue
        }

        const userName = participant.user?.full_name ?? ''
        const syntheticInviteId = participant.id + 100_000_000

        this.logger.log(
          `Auto-call: meeting ${meeting.uuid}, user ${participant.user_id} (attempt 0)`,
        )

        this.meetingsGateway.emitNewInvite(participant.user_id, {
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          meetingUuid: meeting.uuid,
          inviteId: syntheticInviteId,
          userName,
          invitedBy: meeting.host_id,
        })
      }
    }
  }

  /**
   * Fires retry auto-calls for participants who did not join after the initial call.
   */
  private async fireRetryCalls(): Promise<void> {
    let targets: Awaited<
      ReturnType<typeof this.scheduledParticipantsService.findRetryAutoCallTargets>
    >
    try {
      targets = await this.scheduledParticipantsService.findRetryAutoCallTargets()
    } catch (error) {
      this.logger.error('Failed to load retry auto-call targets', (error as Error).message)
      return
    }

    for (const { meeting, participants, attempt } of targets) {
      const activeUserIds = this.meetingsGateway.getActiveUserIds(meeting.id)

      for (const participant of participants) {
        if (activeUserIds.has(participant.user_id)) {
          this.logger.log(
            `Auto-call retry skipped: user ${participant.user_id} already in meeting ${meeting.uuid}`,
          )
          continue
        }

        const userName = participant.user?.full_name ?? ''
        // Use attempt in synthetic ID offset so retries get different IDs
        const syntheticInviteId = participant.id + 100_000_000 + attempt * 1_000_000

        this.logger.log(
          `Auto-call retry ${attempt}: meeting ${meeting.uuid}, user ${participant.user_id}`,
        )

        this.meetingsGateway.emitNewInvite(participant.user_id, {
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          meetingUuid: meeting.uuid,
          inviteId: syntheticInviteId,
          userName,
          invitedBy: meeting.host_id,
        })
      }
    }
  }
}
