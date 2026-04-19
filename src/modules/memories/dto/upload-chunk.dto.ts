import { IsString, IsNotEmpty, IsNumber, IsUUID } from 'class-validator'
import { Type } from 'class-transformer'

export class UploadChunkDto {
  @IsUUID()
  uploadId!: string

  @Type(() => Number)
  @IsNumber()
  chunkIndex!: number

  @Type(() => Number)
  @IsNumber()
  totalChunks!: number

  @IsString()
  @IsNotEmpty()
  fileName!: string

  @IsString()
  @IsNotEmpty()
  mimeType!: string

  @Type(() => Number)
  @IsNumber()
  totalSize!: number
}

export class CompleteChunkUploadDto {
  @IsUUID()
  uploadId!: string

  @IsString()
  @IsNotEmpty()
  fileName!: string

  @IsString()
  @IsNotEmpty()
  mimeType!: string

  @Type(() => Number)
  @IsNumber()
  totalChunks!: number

  @Type(() => Number)
  @IsNumber()
  totalSize!: number
}
