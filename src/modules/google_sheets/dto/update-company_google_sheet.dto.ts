import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ColumnConfigItemDto } from './create-company_google_sheet.dto'
import type { ColumnConfigItem } from '../entities/company_google_sheet.entity'

export class UpdateCompanyGoogleSheetDto {
  @IsString()
  @IsOptional()
  request_type?: string

  @IsString()
  @IsOptional()
  spreadsheet_id?: string

  @IsString()
  @IsOptional()
  sheet_name?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnConfigItemDto)
  @IsOptional()
  column_config?: ColumnConfigItem[] | null

  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}
