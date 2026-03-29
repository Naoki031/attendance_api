import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Country } from './entities/country.entity'
import { CreateCountryDto } from './dto/create-country.dto'
import { UpdateCountryDto } from './dto/update-country.dto'

interface CountryFilters {
  search?: string
}

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
    const country = this.countryRepository.save(createCountryDto)

    return country
  }

  /**
   * Retrieves all countries from the repository.
   *
   * @returns A promise that resolves to an array of countries.
   */
  async findAll(): Promise<Country[]> {
    const countries = await this.countryRepository.find()

    return countries
  }

  /**
   * Retrieves countries matching the given filter criteria.
   *
   * @param {CountryFilters} filters - The filter criteria.
   * @returns A promise that resolves to an array of matching countries.
   */
  async findWithFilters(filters: CountryFilters): Promise<Country[]> {
    const queryBuilder = this.countryRepository.createQueryBuilder('country')

    if (filters.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`
      queryBuilder.andWhere(
        '(LOWER(country.name) LIKE :search OR LOWER(country.slug) LIKE :search OR LOWER(country.capital) LIKE :search)',
        { search: searchTerm },
      )
    }

    return queryBuilder.getMany()
  }

  /**
   * Retrieves a country with the specified ID from the repository.
   *
   * @param {number} countryId - The ID of the country to retrieve.
   * @returns A promise that resolves to the country with the specified ID.
   * @throws NotFoundException if the country with the specified ID is not found.
   */
  findOne(countryId: number): Promise<Country> {
    const country = this.countryRepository.findOne({ where: { id: countryId } })

    if (!country) {
      throw new NotFoundException('Country not found')
    }

    return country
  }

  /**
   * Updates the details of an existing country.
   *
   * @param {number} countryId - The ID of the country to update.
   * @param {UpdateCountryDto} updateCountryDto - The data transfer object containing the updated country details.
   * @returns A promise that resolves to the updated country.
   * @throws NotFoundException if the country with the specified ID is not found.
   */
  async update(countryId: number, updateCountryDto: UpdateCountryDto): Promise<Country> {
    await this.countryRepository.update({ id: countryId }, { ...updateCountryDto })

    const country = this.findOne(countryId)

    if (!country) {
      throw new NotFoundException('Country not found')
    }

    return country
  }

  /**
   * Deletes a country with the specified ID from the repository.
   *
   * @param {number} countryId - The ID of the country to delete.
   * @returns A promise that resolves to the result of the deletion operation.
   * @throws NotFoundException if the country with the specified ID is not found.
   */
  async remove(countryId: number) {
    return await this.countryRepository.delete({ id: countryId })
  }
}
