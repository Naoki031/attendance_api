import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator'

export class CreateCityDto {
  @IsNumber()
  @IsNotEmpty()
  country_id!: number

  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  slug!: string

  @IsBoolean()
  @IsOptional()
  is_capital?: boolean

  @IsNumber()
  @IsOptional()
  latitude?: number

  @IsNumber()
  @IsOptional()
  longitude?: number
}
