import { IsDateString, IsNotEmpty } from 'class-validator'

export class SwapDatesDto {
  /** First date to swap. */
  @IsDateString()
  @IsNotEmpty()
  date_a!: string

  /** Second date to swap. */
  @IsDateString()
  @IsNotEmpty()
  date_b!: string
}
