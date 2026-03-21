import { IsNumber, IsNotEmpty } from 'class-validator'

export class CreateUserDepartmentDto {
  @IsNumber()
  @IsNotEmpty()
  user_id: number

  @IsNumber()
  @IsNotEmpty()
  company_id: number

  @IsNumber()
  @IsNotEmpty()
  department_id: number
}
