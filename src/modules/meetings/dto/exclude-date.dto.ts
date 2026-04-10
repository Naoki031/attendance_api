import { IsDateString, IsNotEmpty } from 'class-validator'

export class ExcludeDateDto {
  @IsDateString()
  @IsNotEmpty()
  date!: string
}
