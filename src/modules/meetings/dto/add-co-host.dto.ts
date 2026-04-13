import { IsNotEmpty, IsNumber } from 'class-validator'

export class AddCoHostDto {
  @IsNumber()
  @IsNotEmpty()
  user_id!: number
}
