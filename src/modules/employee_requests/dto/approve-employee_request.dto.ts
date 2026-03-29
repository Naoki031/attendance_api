import { IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator'
import { EmployeeRequestStatus } from '../entities/employee_request.entity'

export class ApproveEmployeeRequestDto {
  @IsEnum([EmployeeRequestStatus.APPROVED, EmployeeRequestStatus.REJECTED])
  @IsNotEmpty()
  status!: EmployeeRequestStatus.APPROVED | EmployeeRequestStatus.REJECTED

  @IsString()
  @IsOptional()
  note?: string
}
