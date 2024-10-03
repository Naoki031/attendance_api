import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Creates a new user in the repository.
   *
   * @param {CreateUserDto} createUserDto - The data transfer object containing the details of the user to be created.
   * @returns {Promise<User>} A promise that resolves to the created user.
   */
  create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.save(createUserDto);

    return user;
  }

  /**
   * Retrieves all users from the repository.
   *
   * @returns {Promise<User[]>} A promise that resolves to an array of all users.
   */
  findAll(): Promise<User[]> {
    const users = this.userRepository.find();

    return users;
  }

  /**
   * Finds a user by their email address.
   *
   * @param email - The email address of the user to find.
   * @returns A promise that resolves to the user if found.
   * @throws NotFoundException if no user is found with the given email address.
   */
  async findOneByEmail(email: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({ where: { email } });

    return user;
  }

  /**
   * Retrieves a user from the repository based on the provided user ID.
   *
   * @param {number} id - The ID of the user to retrieve.
   * @returns {Promise<User>} A promise that resolves to the user with the given ID.
   * @throws {NotFoundException} If the user with the given ID is not found.
   */
  findOne(id: number): Promise<User> {
    const user = this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Updates a user's information based on the provided user ID and update data.
   *
   * @param {number} id - The ID of the user to update.
   * @param {UpdateUserDto} updateUserDto - The data to update the user with.
   * @returns {Promise<User>} A promise that resolves to the updated user.
   * @throws {NotFoundException} If the user with the given ID is not found.
   */
  update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    this.userRepository.update({ id: id }, { ...updateUserDto });

    const user = this.findOne(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Removes a user from the repository by their ID.
   *
   * @param id - The ID of the user to be removed.
   * @returns A promise that resolves to the result of the delete operation.
   */
  remove(id: number) {
    return this.userRepository.delete({ id });
  }
}
