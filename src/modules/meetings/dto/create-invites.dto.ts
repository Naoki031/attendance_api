import { IsArray, IsInt, ArrayNotEmpty } from 'class-validator'

export class CreateInvitesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  user_ids!: number[]
}
