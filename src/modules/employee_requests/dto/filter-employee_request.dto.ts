import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { EmployeeRequestStatus, EmployeeRequestType } from '../entities/employee_request.entity'

export class FilterEmployeeRequestDto {
  @IsEnum(EmployeeRequestStatus)
  @IsOptional()
  status?: EmployeeRequestStatus

  @IsEnum(EmployeeRequestType)
  @IsOptional()
  type?: EmployeeRequestType

  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  @Type(() => Number)
  month?: number

  @IsInt()
  @Min(2000)
  @IsOptional()
  @Type(() => Number)
  year?: number

  @IsString()
  @IsOptional()
  search?: string
}
