import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber } from 'class-validator'

export class CreateEmailTemplateDto {
  @IsString()
  @IsNotEmpty()
  key: string

  @IsString()
  @IsNotEmpty()
  subject: string

  @IsString()
  @IsNotEmpty()
  body_html: string

  @IsString()
  @IsOptional()
  description?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[]

  /** Company ID — null for global, or a number for company-specific. */
  @IsOptional()
  @IsNumber()
  company_id?: number | null
}
