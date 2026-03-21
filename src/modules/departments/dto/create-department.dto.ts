import { IsString, IsNotEmpty, IsOptional } from 'class-validator'

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  slug: string

  @IsOptional()
  @IsString()
  descriptions?: string
}
