import { IsArray, IsNumber } from 'class-validator'

export class ResolveBatchDto {
  @IsArray()
  @IsNumber({}, { each: true })
  ids!: number[]
}
