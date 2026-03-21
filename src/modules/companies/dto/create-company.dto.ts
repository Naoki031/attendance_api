import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator'

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  slug!: string

  @IsNumber()
  @IsOptional()
  country_id?: number

  @IsNumber()
  @IsOptional()
  city_id?: number

  @IsString()
  @IsOptional()
  address?: string

  @IsString()
  @IsOptional()
  phone?: string

  @IsString()
  @IsOptional()
  email?: string

  @IsString()
  @IsOptional()
  website?: string

  @IsString()
  @IsOptional()
  logo?: string
}
