import { IsIn, IsNumber, IsOptional, IsString, IsNotEmpty, Matches } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateUserContractDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  user_id: number

  @IsNotEmpty()
  @IsString()
  @IsIn(['probation', 'fixed_term', 'indefinite'])
  contract_type: string

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'signed_date must be in YYYY-MM-DD format' })
  signed_date: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'expired_date must be in YYYY-MM-DD format' })
  expired_date?: string | null

  @IsOptional()
  @IsString()
  notes?: string | null
}
