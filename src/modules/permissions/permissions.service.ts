import { Injectable } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  /**
   * Creates a new permission.
   *
   * @param createPermissionDto - Data transfer object containing the details of the permission to be created.
   * @returns A promise that resolves to the created permission.
   */
  create(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    createPermissionDto.name = createPermissionDto.name.toUpperCase();

    // Save the new permission to the repository
    const permission = this.permissionRepository.save(createPermissionDto);

    return permission;
  }

  /**
   * Retrieves all permissions from the repository.
   *
   * @returns {Promise<Permission[]>} A promise that resolves to an array of permissions.
   */
  findAll(): Promise<Permission[]> {
    const permissions = this.permissionRepository.find();

    return permissions;
  }

  /**
   * Finds a permission by its ID.
   *
   * @param {number} id - The ID of the permission to find.
   * @returns {Promise<Permission>} A promise that resolves to the found permission.
   */
  findOne(id: number): Promise<Permission> {
    const permission = this.permissionRepository.findOne({ where: { id } });

    return permission;
  }

  /**
   * Updates a permission with the given ID using the provided update data.
   *
   * @param {number} id - The ID of the permission to update.
   * @param {UpdatePermissionDto} updatePermissionDto - The data to update the permission with.
   * @returns {Promise<Permission>} A promise that resolves to the updated permission.
   */
  update(
    id: number,
    updatePermissionDto: UpdatePermissionDto,
  ): Promise<Permission> {
    updatePermissionDto.name = updatePermissionDto.name.toUpperCase();

    // Update the permission with the given ID
    const permission = this.permissionRepository.save({
      id,
      ...updatePermissionDto,
    });

    return permission;
  }

  /**
   * Removes a permission by its ID.
   *
   * @param {number} id - The ID of the permission to remove.
   * @returns {Promise<boolean>} A promise that resolves to `true` if the permission was successfully removed, otherwise `false`.
   */
  async remove(id: number): Promise<boolean> {
    const result = this.permissionRepository.delete(id);

    return result.then((result) => result.affected === 1);
  }
}
