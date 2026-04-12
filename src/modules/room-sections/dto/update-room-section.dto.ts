import { IsString, IsOptional, MaxLength, IsNumber } from 'class-validator'

export class UpdateRoomSectionDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string

  @IsNumber()
  @IsOptional()
  position?: number
}
