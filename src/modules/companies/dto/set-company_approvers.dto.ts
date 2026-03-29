import { IsArray, IsNumber } from 'class-validator'

export class SetCompanyApproversDto {
  @IsArray()
  @IsNumber({}, { each: true })
  user_ids!: number[]
}
