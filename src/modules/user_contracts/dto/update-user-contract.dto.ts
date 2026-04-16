import { IsIn, IsOptional, IsString, Matches } from 'class-validator'

export class UpdateUserContractDto {
  @IsOptional()
  @IsString()
  @IsIn(['probation', 'fixed_term', 'indefinite'])
  contract_type?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'signed_date must be in YYYY-MM-DD format' })
  signed_date?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'expired_date must be in YYYY-MM-DD format' })
  expired_date?: string | null

  @IsOptional()
  @IsString()
  notes?: string | null
}
