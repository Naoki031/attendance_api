import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Meeting } from './entities/meeting.entity'
import { MeetingParticipant } from './entities/meeting_participant.entity'
import { MeetingsService } from './meetings.service'
import { MeetingsController } from './meetings.controller'
import { MeetingsGateway } from './meetings.gateway'
import { TtsService } from './tts.service'
import { SpeechService } from './speech.service'
import { TranslateModule } from '@/modules/translate/translate.module'

@Module({
  imports: [TypeOrmModule.forFeature([Meeting, MeetingParticipant]), TranslateModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingsGateway, TtsService, SpeechService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
