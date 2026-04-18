import {
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator'
import { EventType, Privacy } from '../entities/memory_album.entity'

export class CreateAlbumDto {
  @IsNotEmpty()
  @MaxLength(200)
  title!: string

  @IsOptional()
  @MaxLength(2000)
  description?: string

  @IsEnum(EventType)
  eventType!: EventType

  @IsDateString()
  date!: string

  @IsOptional()
  @IsEnum(Privacy)
  privacy?: Privacy

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[]
}
