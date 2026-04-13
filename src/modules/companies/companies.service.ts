import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Not, Repository } from 'typeorm'
import { Company } from './entities/company.entity'
import { CompanyApprover } from './entities/company_approver.entity'
import { CreateCompanyDto } from './dto/create-company.dto'
import { UpdateCompanyDto } from './dto/update-company.dto'
import { SetCompanyApproversDto } from './dto/set-company_approvers.dto'
import { User } from '@/modules/users/entities/user.entity'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

interface CompanyFilters {
  search?: string
  countryId?: number
  cityId?: number
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name)

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyApprover)
    private readonly companyApproverRepository: Repository<CompanyApprover>,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  /**
   * Creates a new company entry in the repository.
   *
   * @param {CreateCompanyDto} createCompanyDto - The DTO containing company details.
   * @returns A promise that resolves to the created company.
   */
  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    try {
      const duplicate = await this.companyRepository.findOne({
        where: [{ name: createCompanyDto.name }, { slug: createCompanyDto.slug }],
      })

      if (duplicate) {
        if (duplicate.name === createCompanyDto.name) {
          throw new ConflictException('Company name already exists')
        }

        throw new ConflictException('Company slug already exists')
      }

      return await this.companyRepository.save(createCompanyDto)
    } catch (error) {
      this.logger.error('Failed to create company', error)
      this.errorLogsService.logError({
        message: 'Failed to create company',
        stackTrace: (error as Error).stack ?? null,
        path: 'companies',
      })
      throw error
    }
  }

  /**
   * Fetches user counts per company from user_departments table.
   */
  private async fetchUserCountMap(companyIds: number[]): Promise<Map<number, number>> {
    if (companyIds.length === 0) return new Map()

    const rows: { company_id: number; count: string }[] = await this.companyRepository.query(
      `SELECT company_id, COUNT(DISTINCT user_id) as count FROM user_departments WHERE company_id IN (${companyIds.map(() => '?').join(',')}) GROUP BY company_id`,
      companyIds,
    )

    return new Map(rows.map((row) => [Number(row.company_id), Number(row.count)]))
  }

  /**
   * Retrieves all companies from the repository.
   *
   * @returns A promise that resolves to an array of companies.
   */
  async findAll() {
    try {
      const companies = await this.companyRepository.find({ relations: ['country', 'city'] })
      const countMap = await this.fetchUserCountMap(
        companies.map((company) => company.id!).filter(Boolean),
      )

      return companies.map((company) => ({
        ...company,
        user_count: countMap.get(company.id!) ?? 0,
      }))
    } catch (error) {
      this.logger.error('Failed to fetch all companies', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch all companies',
        stackTrace: (error as Error).stack ?? null,
        path: 'companies',
      })
      throw error
    }
  }

  /**
   * Retrieves companies matching the given filter criteria.
   *
   * @param {CompanyFilters} filters - The filter criteria.
   * @returns A promise that resolves to an array of matching companies.
   */
  async findWithFilters(filters: CompanyFilters) {
    try {
      const queryBuilder = this.companyRepository
        .createQueryBuilder('company')
        .leftJoinAndSelect('company.country', 'country')
        .leftJoinAndSelect('company.city', 'city')

      if (filters.search) {
        const searchTerm = `%${filters.search.toLowerCase()}%`
        queryBuilder.andWhere(
          '(LOWER(company.name) LIKE :search OR LOWER(company.slug) LIKE :search OR LOWER(company.email) LIKE :search OR LOWER(company.phone) LIKE :search)',
          { search: searchTerm },
        )
      }

      if (filters.countryId) {
        queryBuilder.andWhere('company.country_id = :countryId', { countryId: filters.countryId })
      }

      if (filters.cityId) {
        queryBuilder.andWhere('company.city_id = :cityId', { cityId: filters.cityId })
      }

      const companies = await queryBuilder.getMany()
      const countMap = await this.fetchUserCountMap(
        companies.map((company) => company.id!).filter(Boolean),
      )

      return companies.map((company) => ({
        ...company,
        user_count: countMap.get(company.id!) ?? 0,
      }))
    } catch (error) {
      this.logger.error('Failed to fetch companies with filters', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch companies with filters',
        stackTrace: (error as Error).stack ?? null,
        path: 'companies',
      })
      throw error
    }
  }

  /**
   * Retrieves a single company by ID.
   *
   * @param {number} companyId - The ID of the company to retrieve.
   * @returns A promise that resolves to the company.
   * @throws NotFoundException if the company is not found.
   */
  async findOne(companyId: number): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
      relations: ['country', 'city'],
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    return company
  }

  /**
   * Updates an existing company by ID.
   *
   * @param {number} companyId - The ID of the company to update.
   * @param {UpdateCompanyDto} updateCompanyDto - The DTO with updated fields.
   * @returns A promise that resolves to the updated company.
   */
  async update(companyId: number, updateCompanyDto: UpdateCompanyDto): Promise<Company> {
    try {
      if (updateCompanyDto.name || updateCompanyDto.slug) {
        const duplicate = await this.companyRepository.findOne({
          where: [
            ...(updateCompanyDto.name ? [{ name: updateCompanyDto.name, id: Not(companyId) }] : []),
            ...(updateCompanyDto.slug ? [{ slug: updateCompanyDto.slug, id: Not(companyId) }] : []),
          ],
        })

        if (duplicate) {
          if (updateCompanyDto.name && duplicate.name === updateCompanyDto.name) {
            throw new ConflictException('Company name already exists')
          }

          throw new ConflictException('Company slug already exists')
        }
      }

      await this.companyRepository.update({ id: companyId }, { ...updateCompanyDto })

      return this.findOne(companyId)
    } catch (error) {
      this.logger.error('Failed to update company', error)
      this.errorLogsService.logError({
        message: 'Failed to update company',
        stackTrace: (error as Error).stack ?? null,
        path: 'companies',
      })
      throw error
    }
  }

  /**
   * Removes a company by ID.
   *
   * @param {number} companyId - The ID of the company to delete.
   * @returns A promise that resolves to the deletion result.
   */
  async remove(companyId: number) {
    try {
      return await this.companyRepository.delete({ id: companyId })
    } catch (error) {
      this.logger.error('Failed to remove company', error)
      this.errorLogsService.logError({
        message: 'Failed to remove company',
        stackTrace: (error as Error).stack ?? null,
        path: 'companies',
      })
      throw error
    }
  }

  /**
   * Retrieves all approvers assigned to a company.
   */
  async findApprovers(companyId: number): Promise<User[]> {
    try {
      const records = await this.companyApproverRepository.find({
        where: { company_id: companyId },
        relations: ['user'],
      })

      return records.map((record) => record.user).filter((user): user is User => user != null)
    } catch (error) {
      this.logger.error('Failed to fetch company approvers', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch company approvers',
        stackTrace: (error as Error).stack ?? null,
        path: 'companies',
      })
      throw error
    }
  }

  /**
   * Replaces the approver list for a company with the given user IDs.
   */
  async setApprovers(companyId: number, dto: SetCompanyApproversDto): Promise<User[]> {
    try {
      await this.findOne(companyId)
      await this.companyApproverRepository.delete({ company_id: companyId })

      if (dto.user_ids.length > 0) {
        const records = dto.user_ids.map((userId) =>
          this.companyApproverRepository.create({ company_id: companyId, user_id: userId }),
        )

        await this.companyApproverRepository.save(records)
      }

      return this.findApprovers(companyId)
    } catch (error) {
      this.logger.error('Failed to set company approvers', error)
      this.errorLogsService.logError({
        message: 'Failed to set company approvers',
        stackTrace: (error as Error).stack ?? null,
        path: 'companies',
      })
      throw error
    }
  }
}
