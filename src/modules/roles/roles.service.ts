import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  /**
   * Creates a new role using the provided data transfer object.
   *
   * @param createRoleDto - The data transfer object containing the details of the role to be created.
   * @returns A promise that resolves to the created role.
   */
  create(createRoleDto: CreateRoleDto): Promise<Role> {
    const role = this.roleRepository.save(createRoleDto);

    return role;
  }

  /**
   * Retrieves all roles from the repository.
   *
   * @returns {Promise<Role[]>} A promise that resolves to an array of roles.
   */
  findAll(): Promise<Role[]> {
    const roles = this.roleRepository.find();

    return roles;
  }

  /**
   * Finds a role by its ID.
   *
   * @param {number} id - The ID of the role to find.
   * @returns {Promise<Role>} A promise that resolves to the found role.
   */
  findOne(id: number): Promise<Role> {
    const role = this.roleRepository.findOne({ where: { id } });

    return role;
  }

  /**
   * Updates an existing role with the provided data.
   *
   * @param {number} id - The ID of the role to update.
   * @param {UpdateRoleDto} updateRoleDto - The data to update the role with.
   * @returns {Promise<Role>} A promise that resolves to the updated role.
   */
  update(id: number, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = this.roleRepository.save({ id, ...updateRoleDto });

    return role;
  }

  /**
   * Removes a role by its ID.
   *
   * @param {number} id - The ID of the role to remove.
   * @returns {Promise<boolean>} A promise that resolves to `true` if the role was successfully removed, otherwise `false`.
   */
  remove(id: number): Promise<boolean> {
    return this.roleRepository
      .delete(id)
      .then((result) => result.affected === 1);
  }
}
