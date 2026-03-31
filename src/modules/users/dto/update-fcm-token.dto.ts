import { IsString, IsNotEmpty } from 'class-validator'

export class UpdateFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  fcm_token: string
}
