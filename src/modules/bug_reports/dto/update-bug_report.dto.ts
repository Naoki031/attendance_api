import { IsEnum, IsString, IsOptional } from 'class-validator'
import { BugReportStatus } from '../entities/bug_report.entity'

export class UpdateBugReportDto {
  @IsEnum(BugReportStatus)
  @IsOptional()
  status?: BugReportStatus

  @IsString()
  @IsOptional()
  admin_note?: string
}
