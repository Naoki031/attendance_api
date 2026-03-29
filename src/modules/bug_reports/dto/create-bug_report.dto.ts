import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'

export class CreateBugReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  screenshot?: string
}
