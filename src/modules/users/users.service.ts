import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { USER_REPOSITORY } from 'src/core/constants/repository';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: typeof User,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = await this.userRepository.create<User>({
      ...createUserDto,
    });
    return user;
  }

  findAll() {
    return this.userRepository.findAll<User>();
  }

  findOneById(id: number) {
    const user = this.userRepository.findOne<User>({ where: { user_id: id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findOneByEmail(email: string) {
    const user = this.userRepository.findOne<User>({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
