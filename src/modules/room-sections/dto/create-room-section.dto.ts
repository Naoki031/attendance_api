import { IsString, IsNotEmpty, MaxLength, IsOptional, IsNumber } from 'class-validator'

export class CreateRoomSectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsNumber()
  @IsOptional()
  position?: number
}
