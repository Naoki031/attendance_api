import { IsIn } from 'class-validator'

export class RsvpDto {
  @IsIn(['accepted', 'declined'])
  status!: 'accepted' | 'declined'
}
