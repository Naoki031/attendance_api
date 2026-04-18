import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { EventType, Privacy } from '../entities/memory_album.entity'

export class QueryAlbumsDto {
  @IsOptional()
  @IsEnum(Privacy)
  privacy?: Privacy

  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20
}
