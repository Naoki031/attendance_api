import { IsString, IsNumber } from 'class-validator'

export class ClockQrDto {
  @IsString()
  token!: string

  @IsNumber()
  companyId!: number

  @IsString()
  date!: string
}
