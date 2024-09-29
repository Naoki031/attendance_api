import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  key?: string;

  @IsString()
  @IsOptional()
  descriptions?: string;
}
