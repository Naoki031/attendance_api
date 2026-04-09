import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Meeting } from './entities/meeting.entity'
import { MeetingParticipant } from './entities/meeting_participant.entity'
import { MeetingHostSchedule } from './entities/meeting_host_schedule.entity'
import { MeetingPin } from './entities/meeting_pin.entity'
import { MeetingCompany } from './entities/meeting_company.entity'
import { MeetingsService } from './meetings.service'
import { MeetingsController } from './meetings.controller'
import { MeetingsGateway } from './meetings.gateway'
import { MeetingHostSchedulesService } from './meeting_host_schedules.service'
import { MeetingHostSchedulesController } from './meeting_host_schedules.controller'
import { TtsService } from './tts.service'
import { SpeechService } from './speech.service'
import { TranslateModule } from '@/modules/translate/translate.module'
import { SlackChannelsModule } from '@/modules/slack_channels/slack_channels.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Meeting,
      MeetingParticipant,
      MeetingHostSchedule,
      MeetingPin,
      MeetingCompany,
    ]),
    TranslateModule,
    SlackChannelsModule,
  ],
  controllers: [MeetingsController, MeetingHostSchedulesController],
  providers: [
    MeetingsService,
    MeetingHostSchedulesService,
    MeetingsGateway,
    TtsService,
    SpeechService,
  ],
  exports: [MeetingsService, MeetingHostSchedulesService],
})
export class MeetingsModule {}
