import { IsArray, IsString } from 'class-validator'

export class UpdateMembersDto {
  @IsArray()
  @IsString({ each: true })
  memberIds!: string[]
}
