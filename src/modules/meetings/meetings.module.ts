import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Meeting } from './entities/meeting.entity'
import { MeetingParticipant } from './entities/meeting_participant.entity'
import { MeetingHostSchedule } from './entities/meeting_host_schedule.entity'
import { MeetingPin } from './entities/meeting_pin.entity'
import { MeetingCompany } from './entities/meeting_company.entity'
import { MeetingInvite } from './entities/meeting_invite.entity'
import { MeetingsService } from './meetings.service'
import { MeetingsController } from './meetings.controller'
import { MeetingsGateway } from './meetings.gateway'
import { MeetingHostSchedulesService } from './meeting_host_schedules.service'
import { MeetingHostSchedulesController } from './meeting_host_schedules.controller'
import { TtsService } from './tts.service'
import { SpeechService } from './speech.service'
import { TranslateModule } from '@/modules/translate/translate.module'
import { SlackChannelsModule } from '@/modules/slack_channels/slack_channels.module'
import { UsersModule } from '@/modules/users/users.module'
import { ChatModule } from '@/modules/chat/chat.module'
import { FirebaseModule } from '@/modules/firebase/firebase.module'
import { AuthModule } from '@/modules/auth/auth.module'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Meeting,
      MeetingParticipant,
      MeetingHostSchedule,
      MeetingPin,
      MeetingCompany,
      MeetingInvite,
    ]),
    TranslateModule,
    SlackChannelsModule,
    UsersModule,
    ChatModule,
    FirebaseModule,
    AuthModule,
    UserGroupPermissionsModule,
  ],
  controllers: [MeetingsController, MeetingHostSchedulesController],
  providers: [
    MeetingsService,
    MeetingHostSchedulesService,
    MeetingsGateway,
    TtsService,
    SpeechService,
  ],
  exports: [MeetingsService, MeetingHostSchedulesService, MeetingsGateway],
})
export class MeetingsModule {}
