import { IsOptional, IsString, IsNumber, IsBoolean, Min } from 'class-validator'
import { Transform, Type } from 'class-transformer'

export class QueryErrorLogDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50

  @IsOptional()
  @IsString()
  level?: 'error' | 'warn' | 'fatal'

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false

    return undefined
  })
  @IsBoolean()
  is_resolved?: boolean

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsString()
  date_from?: string

  @IsOptional()
  @IsString()
  date_to?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  status_code?: number
}
