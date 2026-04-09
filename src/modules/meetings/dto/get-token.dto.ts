import { IsOptional, IsString } from 'class-validator'

export class GetTokenDto {
  @IsOptional()
  @IsString()
  password?: string
}
