import { IsArray, IsInt, ArrayMinSize } from 'class-validator'

export class CreateScheduledParticipantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  user_ids!: number[]
}
