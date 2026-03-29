import { PartialType } from '@nestjs/mapped-types'
import { CreateSlackChannelDto } from './create-slack_channel.dto'

export class UpdateSlackChannelDto extends PartialType(CreateSlackChannelDto) {}
