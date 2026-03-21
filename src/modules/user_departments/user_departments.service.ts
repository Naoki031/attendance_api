import { Injectable, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserDepartment } from './entities/user_department.entity'
import { CreateUserDepartmentDto } from './dto/create-user_department.dto'

@Injectable()
export class UserDepartmentsService {
  constructor(
    @InjectRepository(UserDepartment)
    private readonly userDepartmentRepository: Repository<UserDepartment>,
  ) {}

  /**
   * Assigns a user to a department within a company.
   *
   * @param {CreateUserDepartmentDto} createDto - DTO containing user_id, company_id, department_id.
   * @returns A promise that resolves to the created assignment.
   */
  async create(createDto: CreateUserDepartmentDto): Promise<UserDepartment> {
    const existing = await this.userDepartmentRepository.findOne({
      where: {
        user_id: createDto.user_id,
        department_id: createDto.department_id,
        company_id: createDto.company_id,
      },
    })

    if (existing) {
      throw new ConflictException(
        'This user is already assigned to this department in the same company',
      )
    }

    return this.userDepartmentRepository.save(createDto)
  }

  /**
   * Retrieves all user-department assignments with relations.
   *
   * @returns A promise that resolves to an array of all assignments.
   */
  async findAll(): Promise<UserDepartment[]> {
    return this.userDepartmentRepository.find({
      relations: ['user', 'department', 'company'],
    })
  }

  /**
   * Retrieves all users assigned to a specific department.
   *
   * @param {number} departmentId - The ID of the department.
   * @returns A promise that resolves to an array of assignments for that department.
   */
  async findByDepartment(departmentId: number): Promise<UserDepartment[]> {
    return this.userDepartmentRepository.find({
      where: { department_id: departmentId },
      relations: ['user', 'company'],
    })
  }

  /**
   * Removes a user-department assignment by ID.
   *
   * @param {number} id - The ID of the assignment to remove.
   * @returns A promise that resolves to the result of the deletion.
   */
  async remove(id: number) {
    return this.userDepartmentRepository.delete({ id })
  }
}
