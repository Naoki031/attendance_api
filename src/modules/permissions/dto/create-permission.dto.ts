import { IsString, IsNotEmpty, IsOptional } from 'class-validator'

export class CreatePermissionDto {
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
