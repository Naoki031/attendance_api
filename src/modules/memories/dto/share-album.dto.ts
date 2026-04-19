import { IsUUID, IsOptional, MaxLength } from 'class-validator'

export class ShareAlbumDto {
  @IsUUID()
  albumId!: string

  @IsUUID()
  chatRoomId!: string

  @IsOptional()
  @MaxLength(500)
  message?: string
}
