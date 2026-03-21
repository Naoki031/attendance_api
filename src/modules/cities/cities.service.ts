import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Not, Repository } from 'typeorm'
import { City } from './entities/city.entity'
import { CreateCityDto } from './dto/create-city.dto'
import { UpdateCityDto } from './dto/update-city.dto'

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
  ) {}

  /**
   * Creates a new city entry in the repository.
   *
   * @param {CreateCityDto} createCityDto - The DTO containing city details.
   * @returns A promise that resolves to the created city.
   * @throws ConflictException if name or slug already exists.
   */
  async create(createCityDto: CreateCityDto): Promise<City> {
    const duplicate = await this.cityRepository.findOne({
      where: [{ name: createCityDto.name }, { slug: createCityDto.slug }],
    })

    if (duplicate) {
      if (duplicate.name === createCityDto.name) {
        throw new ConflictException('City name already exists')
      }
      throw new ConflictException('City slug already exists')
    }

    return this.cityRepository.save(createCityDto)
  }

  /**
   * Retrieves all cities with their country relation.
   *
   * @returns A promise that resolves to an array of cities.
   */
  async findAll(): Promise<City[]> {
    return this.cityRepository.find({ relations: ['country'] })
  }

  /**
   * Retrieves a single city by ID.
   *
   * @param {number} cityId - The ID of the city to retrieve.
   * @returns A promise that resolves to the city.
   * @throws NotFoundException if the city is not found.
   */
  async findOne(cityId: number): Promise<City> {
    const city = await this.cityRepository.findOne({
      where: { id: cityId },
      relations: ['country'],
    })

    if (!city) {
      throw new NotFoundException('City not found')
    }

    return city
  }

  /**
   * Updates an existing city by ID.
   *
   * @param {number} cityId - The ID of the city to update.
   * @param {UpdateCityDto} updateCityDto - The DTO with updated fields.
   * @returns A promise that resolves to the updated city.
   * @throws ConflictException if name or slug already exists on another city.
   */
  async update(cityId: number, updateCityDto: UpdateCityDto): Promise<City> {
    if (updateCityDto.name || updateCityDto.slug) {
      const duplicate = await this.cityRepository.findOne({
        where: [
          ...(updateCityDto.name ? [{ name: updateCityDto.name, id: Not(cityId) }] : []),
          ...(updateCityDto.slug ? [{ slug: updateCityDto.slug, id: Not(cityId) }] : []),
        ],
      })

      if (duplicate) {
        if (updateCityDto.name && duplicate.name === updateCityDto.name) {
          throw new ConflictException('City name already exists')
        }
        throw new ConflictException('City slug already exists')
      }
    }

    await this.cityRepository.update({ id: cityId }, { ...updateCityDto })

    return this.findOne(cityId)
  }

  /**
   * Removes a city by ID.
   *
   * @param {number} cityId - The ID of the city to delete.
   * @returns A promise that resolves to the deletion result.
   */
  async remove(cityId: number) {
    return this.cityRepository.delete({ id: cityId })
  }
}
