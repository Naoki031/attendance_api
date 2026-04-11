import { IsInt, IsBoolean, IsOptional, Min, Max } from 'class-validator'

export class UpsertAutoCallConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  minutes_before?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  retry_count?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  retry_interval_minutes?: number

  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean
}
