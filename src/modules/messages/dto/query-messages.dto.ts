import { IsOptional, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class QueryMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cursor?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number
}
