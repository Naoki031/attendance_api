import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ROLE_REPOSITORY } from 'src/core/constants/repository';

@Injectable()
export class RolesService {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: typeof Role,
  ) {}

  async create(createRoleDto: CreateRoleDto) {
    const role = await this.roleRepository.create<Role>({
      ...createRoleDto,
    });
    return role;
  }

  findAll() {
    return this.roleRepository.findAll<Role>();
  }

  findOne(id: number) {
    const country = this.roleRepository.findOne<Role>({
      where: { role_id: id },
    });
    if (!country) {
      throw new NotFoundException('Country not found');
    }
    return country;
  }

  update(id: number, updateRoleDto: UpdateRoleDto) {
    return `This action updates a #${id} role`;
  }

  remove(id: number) {
    return `This action removes a #${id} role`;
  }
}
