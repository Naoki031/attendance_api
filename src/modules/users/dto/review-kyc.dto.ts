import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

export class ReviewKycDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejection_reason?: string
}
