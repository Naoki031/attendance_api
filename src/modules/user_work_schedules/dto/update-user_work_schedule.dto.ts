import { IsString, IsOptional } from 'class-validator'
import { Transform } from 'class-transformer'

export class UpdateUserWorkScheduleDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  start_time?: string

  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  end_time?: string

  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  effective_from?: string

  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  effective_to?: string

  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  note?: string
}
