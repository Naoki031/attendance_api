import { IsIn, IsOptional, IsString, Matches } from 'class-validator'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  first_name?: string

  @IsOptional()
  @IsString()
  last_name?: string

  @IsOptional()
  @IsString()
  position?: string

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\s\-().]*$/, {
    message: 'phone_number must contain only digits and phone characters',
  })
  phone_number?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  date_of_birth?: string

  @IsOptional()
  @IsString()
  join_date?: string

  @IsOptional()
  @IsString()
  @IsIn(['en', 'vi', 'ja'])
  preferred_language?: string
}
