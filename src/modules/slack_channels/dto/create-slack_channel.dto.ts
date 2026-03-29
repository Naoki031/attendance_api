import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUrl,
  IsArray,
  IsBoolean,
} from 'class-validator'
import { SlackChannelFeature } from '../entities/slack_channel.entity'

export class CreateSlackChannelDto {
  @IsNumber()
  @IsOptional()
  company_id?: number

  @IsString()
  @IsNotEmpty()
  name!: string

  @IsUrl()
  @IsNotEmpty()
  webhook_url!: string

  @IsString()
  @IsOptional()
  channel_id?: string

  @IsEnum(SlackChannelFeature)
  @IsNotEmpty()
  feature!: SlackChannelFeature

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  mention_user_ids?: number[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mention_slack_group_handles?: string[]

  @IsString()
  @IsOptional()
  message_template?: string

  @IsBoolean()
  @IsOptional()
  include_approval_link?: boolean

  @IsBoolean()
  @IsOptional()
  include_my_requests_link?: boolean
}
