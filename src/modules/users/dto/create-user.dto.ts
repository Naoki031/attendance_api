import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsNumberString,
  IsBoolean,
} from 'class-validator';
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  user_name: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  sub_email?: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  birthday?: Date;
  gender?: string;
  address?: string;

  @IsNotEmpty()
  @IsNumberString()
  phone_number?: string;

  sub_phone_number?: string;
  hire_date?: Date;
  salary?: number;
  avatar?: string;

  @IsNotEmpty()
  @IsBoolean()
  is_active: boolean;

  @IsNotEmpty()
  @IsString()
  language: string;

  @IsNotEmpty()
  @IsString()
  roles: string[];
}
