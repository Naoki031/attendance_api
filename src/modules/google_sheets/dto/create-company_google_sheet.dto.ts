import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import type { ColumnConfigItem } from '../entities/company_google_sheet.entity'

export class ColumnConfigItemDto implements ColumnConfigItem {
  @IsString()
  @IsNotEmpty()
  column: string

  @IsString()
  @IsNotEmpty()
  field: string

  @IsString()
  @IsNotEmpty()
  header: string
}

export class CreateCompanyGoogleSheetDto {
  @IsNumber()
  @IsNotEmpty()
  company_id: number

  @IsString()
  @IsOptional()
  request_type?: string

  @IsString()
  @IsNotEmpty()
  spreadsheet_id: string

  @IsString()
  @IsOptional()
  sheet_name?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnConfigItemDto)
  @IsOptional()
  column_config?: ColumnConfigItem[]

  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}
