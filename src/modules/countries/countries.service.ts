import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from './entities/country.entity';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {}

  /**
   * Creates a new country entry in the repository.
   *
   * @param {CreateCountryDto} createCountryDto - The data transfer object containing the details of the country to be created.
   * @returns A promise that resolves to the created country.
   */
  async create(createCountryDto: CreateCountryDto): Promise<Country> {
    const country = this.countryRepository.save(createCountryDto);

    return country;
  }

  /**
   * Retrieves all countries from the repository.
   *
   * @returns A promise that resolves to an array of countries.
   */
  async findAll(): Promise<Country[]> {
    const countries = await this.countryRepository.find();

    return countries;
  }

  /**
   * Retrieves a country with the specified ID from the repository.
   *
   * @param {number} id - The ID of the country to retrieve.
   * @returns A promise that resolves to the country with the specified ID.
   * @throws NotFoundException if the country with the specified ID is not found.
   */
  findOne(id: number): Promise<Country> {
    const country = this.countryRepository.findOne({ where: { id } });

    if (!country) {
      throw new NotFoundException('Country not found');
    }

    return country;
  }

  /**
   * Updates the details of an existing country.
   *
   * @param {number} id - The ID of the country to update.
   * @param {UpdateCountryDto} updateCountryDto - The data transfer object containing the updated country details.
   * @returns A promise that resolves to the updated country.
   * @throws NotFoundException if the country with the specified ID is not found.
   */
  async update(
    id: number,
    updateCountryDto: UpdateCountryDto,
  ): Promise<Country> {
    await this.countryRepository.update({ id }, { ...updateCountryDto });

    const country = this.findOne(id);

    if (!country) {
      throw new NotFoundException('Country not found');
    }

    return country;
  }

  /**
   * Deletes a country with the specified ID from the repository.
   *
   * @param {number} countryId - The ID of the country to delete.
   * @returns A promise that resolves to the result of the deletion operation.
   * @throws NotFoundException if the country with the specified ID is not found.
   */
  async remove(id: number) {
    return await this.countryRepository.delete({ id });
  }
}
