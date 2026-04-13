import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Not, Repository } from 'typeorm'
import { City } from './entities/city.entity'
import { CreateCityDto } from './dto/create-city.dto'
import { UpdateCityDto } from './dto/update-city.dto'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

interface CityFilters {
  search?: string
  countryId?: number
}

@Injectable()
export class CitiesService {
  private readonly logger = new Logger(CitiesService.name)

  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  /**
   * Creates a new city entry in the repository.
   *
   * @param {CreateCityDto} createCityDto - The DTO containing city details.
   * @returns A promise that resolves to the created city.
   * @throws ConflictException if name or slug already exists.
   */
  async create(createCityDto: CreateCityDto): Promise<City> {
    try {
      const duplicate = await this.cityRepository.findOne({
        where: [{ name: createCityDto.name }, { slug: createCityDto.slug }],
      })

      if (duplicate) {
        if (duplicate.name === createCityDto.name) {
          throw new ConflictException('City name already exists')
        }
        throw new ConflictException('City slug already exists')
      }

      return await this.cityRepository.save(createCityDto)
    } catch (error) {
      this.logger.error('Failed to create city', error)
      this.errorLogsService.logError({
        message: 'Failed to create city',
        stackTrace: (error as Error).stack ?? null,
        path: 'cities',
      })
      throw error
    }
  }

  /**
   * Retrieves all cities with their country relation.
   *
   * @returns A promise that resolves to an array of cities.
   */
  async findAll(): Promise<City[]> {
    try {
      return await this.cityRepository.find({ relations: ['country'] })
    } catch (error) {
      this.logger.error('Failed to fetch all cities', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch all cities',
        stackTrace: (error as Error).stack ?? null,
        path: 'cities',
      })
      throw error
    }
  }

  /**
   * Retrieves cities matching the given filter criteria.
   *
   * @param {CityFilters} filters - The filter criteria.
   * @returns A promise that resolves to an array of matching cities.
   */
  async findWithFilters(filters: CityFilters): Promise<City[]> {
    try {
      const queryBuilder = this.cityRepository
        .createQueryBuilder('city')
        .leftJoinAndSelect('city.country', 'country')

      if (filters.search) {
        const searchTerm = `%${filters.search.toLowerCase()}%`
        queryBuilder.andWhere('(LOWER(city.name) LIKE :search OR LOWER(city.slug) LIKE :search)', {
          search: searchTerm,
        })
      }

      if (filters.countryId) {
        queryBuilder.andWhere('city.country_id = :countryId', { countryId: filters.countryId })
      }

      return await queryBuilder.getMany()
    } catch (error) {
      this.logger.error('Failed to fetch cities with filters', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch cities with filters',
        stackTrace: (error as Error).stack ?? null,
        path: 'cities',
      })
      throw error
    }
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
    try {
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
    } catch (error) {
      this.logger.error('Failed to update city', error)
      this.errorLogsService.logError({
        message: 'Failed to update city',
        stackTrace: (error as Error).stack ?? null,
        path: 'cities',
      })
      throw error
    }
  }

  /**
   * Removes a city by ID.
   *
   * @param {number} cityId - The ID of the city to delete.
   * @returns A promise that resolves to the deletion result.
   */
  async remove(cityId: number) {
    try {
      return await this.cityRepository.delete({ id: cityId })
    } catch (error) {
      this.logger.error('Failed to remove city', error)
      this.errorLogsService.logError({
        message: 'Failed to remove city',
        stackTrace: (error as Error).stack ?? null,
        path: 'cities',
      })
      throw error
    }
  }
}
