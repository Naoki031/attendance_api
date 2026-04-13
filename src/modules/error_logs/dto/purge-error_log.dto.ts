import { IsNumber, Min } from 'class-validator'

export class PurgeErrorLogDto {
  @IsNumber()
  @Min(1)
  olderThanDays!: number
}
