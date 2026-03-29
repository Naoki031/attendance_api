import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator'
import { Transform } from 'class-transformer'

export class CreateUserWorkScheduleDto {
  @IsNumber()
  @IsNotEmpty()
  user_id!: number

  @IsString()
  @IsNotEmpty()
  start_time!: string

  @IsString()
  @IsNotEmpty()
  end_time!: string

  @IsString()
  @IsNotEmpty()
  effective_from!: string

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
