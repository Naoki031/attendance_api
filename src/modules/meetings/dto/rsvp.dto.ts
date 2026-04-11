import { IsIn } from 'class-validator'

export class RsvpDto {
  @IsIn(['accepted', 'declined', 'maybe'])
  status!: 'accepted' | 'declined' | 'maybe'
}
