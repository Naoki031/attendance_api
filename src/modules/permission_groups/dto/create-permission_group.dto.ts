import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreatePermissionGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  permissions: string[];

  @IsString()
  @IsOptional()
  descriptions?: string;
}
