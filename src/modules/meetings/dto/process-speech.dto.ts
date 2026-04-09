import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class ProcessSpeechDto {
  @IsNotEmpty()
  @IsString()
  audioBase64: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetLanguages?: string[]
}
