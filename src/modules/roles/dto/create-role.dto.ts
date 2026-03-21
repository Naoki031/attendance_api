import { IsString, IsNotEmpty, IsOptional } from 'class-validator'

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  key?: string

  @IsString()
  @IsOptional()
  descriptions?: string
}
