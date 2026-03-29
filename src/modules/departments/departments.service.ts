import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Department } from './entities/department.entity'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'

interface DepartmentFilters {
  search?: string
}

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  /**
   * Creates a new department entry.
   *
   * @param {CreateDepartmentDto} createDepartmentDto - The data transfer object containing department details.
   * @returns A promise that resolves to the created department.
   */
  async create(createDepartmentDto: CreateDepartmentDto): Promise<Department> {
    return this.departmentRepository.save(createDepartmentDto)
  }

  /**
   * Retrieves all department entries.
   *
   * @returns A promise that resolves to an array of departments.
   */
  async findAll(): Promise<Department[]> {
    return this.departmentRepository.find()
  }

  /**
   * Retrieves departments matching the given filter criteria.
   *
   * @param {DepartmentFilters} filters - The filter criteria.
   * @returns A promise that resolves to an array of matching departments.
   */
  async findWithFilters(filters: DepartmentFilters): Promise<Department[]> {
    const queryBuilder = this.departmentRepository.createQueryBuilder('department')

    if (filters.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`
      queryBuilder.andWhere(
        '(LOWER(department.name) LIKE :search OR LOWER(department.slug) LIKE :search OR LOWER(department.descriptions) LIKE :search)',
        { search: searchTerm },
      )
    }

    return queryBuilder.getMany()
  }

  /**
   * Retrieves a single department by ID.
   *
   * @param {number} departmentId - The ID of the department to retrieve.
   * @returns A promise that resolves to the department with the specified ID.
   * @throws NotFoundException if the department is not found.
   */
  findOne(departmentId: number): Promise<Department> {
    const department = this.departmentRepository.findOne({ where: { id: departmentId } })

    if (!department) {
      throw new NotFoundException('Department not found')
    }

    return department
  }

  /**
   * Updates an existing department by ID.
   *
   * @param {number} departmentId - The ID of the department to update.
   * @param {UpdateDepartmentDto} updateDepartmentDto - The data transfer object containing updated fields.
   * @returns A promise that resolves to the updated department.
   * @throws NotFoundException if the department is not found.
   */
  async update(
    departmentId: number,
    updateDepartmentDto: UpdateDepartmentDto,
  ): Promise<Department> {
    await this.departmentRepository.update({ id: departmentId }, { ...updateDepartmentDto })

    const department = this.findOne(departmentId)

    if (!department) {
      throw new NotFoundException('Department not found')
    }

    return department
  }

  /**
   * Removes a department by ID.
   *
   * @param {number} departmentId - The ID of the department to remove.
   * @returns A promise that resolves to the result of the deletion.
   */
  async remove(departmentId: number) {
    return this.departmentRepository.delete({ id: departmentId })
  }
}
