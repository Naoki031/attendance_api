import { Injectable, NotFoundException } from '@nestjs/common'
import { CreatePermissionGroupDto } from './dto/create-permission_group.dto'
import { UpdatePermissionGroupDto } from './dto/update-permission_group.dto'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PermissionGroup } from './entities/permission_group.entity'

interface PermissionGroupFilters {
  search?: string
}

@Injectable()
export class PermissionGroupsService {
  constructor(
    @InjectRepository(PermissionGroup)
    private readonly permissionGroupRepository: Repository<PermissionGroup>,
  ) {}

  /**
   * Creates a new permission group.
   *
   * @param createPermissionGroupDto - The data transfer object containing the details of the permission group to be created.
   * @returns A promise that resolves to the created PermissionGroup.
   */
  async create(createPermissionGroupDto: CreatePermissionGroupDto): Promise<PermissionGroup> {
    // Create a new PermissionGroup entity
    const permissionGroup = new PermissionGroup()

    // Assign the values from the DTO to the entity
    permissionGroup.name = createPermissionGroupDto.name
    permissionGroup.permissions = createPermissionGroupDto.permissions
    permissionGroup.descriptions = createPermissionGroupDto.descriptions

    // Save the new PermissionGroup entity to the repository
    return await this.permissionGroupRepository.save(permissionGroup)
  }

  /**
   * Retrieves all permission groups from the repository.
   *
   * @returns {Promise<PermissionGroup[]>} A promise that resolves to an array of PermissionGroup objects.
   */
  findAll(): Promise<PermissionGroup[]> {
    return this.permissionGroupRepository.find()
  }

  /**
   * Retrieves permission groups matching the given filter criteria.
   *
   * @param {PermissionGroupFilters} filters - The filter criteria.
   * @returns A promise that resolves to an array of matching permission groups.
   */
  async findWithFilters(filters: PermissionGroupFilters): Promise<PermissionGroup[]> {
    const queryBuilder = this.permissionGroupRepository.createQueryBuilder('permission_group')

    if (filters.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`
      queryBuilder.andWhere(
        '(LOWER(permission_group.name) LIKE :search OR LOWER(permission_group.descriptions) LIKE :search)',
        { search: searchTerm },
      )
    }

    return queryBuilder.getMany()
  }

  /**
   * Finds a single PermissionGroup by its ID.
   *
   * @param permissionGroupId - The ID of the PermissionGroup to find.
   * @returns A promise that resolves to the found PermissionGroup.
   */
  findOne(permissionGroupId: number): Promise<PermissionGroup> {
    const permissionGroup = this.permissionGroupRepository.findOne({
      where: { id: permissionGroupId },
    })

    return permissionGroup
  }

  /**
   * Updates a permission group with the given ID using the provided update data.
   *
   * @param permissionGroupId - The ID of the permission group to update.
   * @param updatePermissionGroupDto - The data transfer object containing the updated permission group data.
   * @returns A promise that resolves to the updated permission group.
   */
  async update(
    permissionGroupId: number,
    updatePermissionGroupDto: UpdatePermissionGroupDto,
  ): Promise<PermissionGroup> {
    // Find the permission group to update
    const permissionGroup = await this.permissionGroupRepository.findOneBy({
      id: permissionGroupId,
    })

    if (!permissionGroup) {
      throw new NotFoundException('PermissionGroup not found')
    }

    // Update only the fields provided in the DTO
    if (updatePermissionGroupDto.name !== undefined) {
      permissionGroup.name = updatePermissionGroupDto.name
    }
    if (updatePermissionGroupDto.permissions !== undefined) {
      permissionGroup.permissions = updatePermissionGroupDto.permissions
    }
    if (updatePermissionGroupDto.descriptions !== undefined) {
      permissionGroup.descriptions = updatePermissionGroupDto.descriptions
    }

    // Save the updated permission group to the repository
    return await this.permissionGroupRepository.save(permissionGroup)
  }

  /**
   * Removes a permission group by its ID.
   *
   * @param {number} permissionGroupId - The ID of the permission group to remove.
   * @returns {Promise<boolean>} - A promise that resolves to `true` if the permission group was successfully removed, otherwise `false`.
   */
  async remove(permissionGroupId: number): Promise<boolean> {
    const result = this.permissionGroupRepository.delete(permissionGroupId)

    return result.then((result) => result.affected === 1)
  }
}
