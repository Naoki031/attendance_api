import { IsOptional, IsBoolean } from 'class-validator'

export class UpdateErrorLogDto {
  @IsOptional()
  @IsBoolean()
  is_resolved?: boolean
}
