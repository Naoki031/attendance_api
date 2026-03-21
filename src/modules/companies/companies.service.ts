import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Not, Repository } from 'typeorm'
import { Company } from './entities/company.entity'
import { CreateCompanyDto } from './dto/create-company.dto'
import { UpdateCompanyDto } from './dto/update-company.dto'

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  /**
   * Creates a new company entry in the repository.
   *
   * @param {CreateCompanyDto} createCompanyDto - The DTO containing company details.
   * @returns A promise that resolves to the created company.
   */
  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    const duplicate = await this.companyRepository.findOne({
      where: [{ name: createCompanyDto.name }, { slug: createCompanyDto.slug }],
    })

    if (duplicate) {
      if (duplicate.name === createCompanyDto.name) {
        throw new ConflictException('Company name already exists')
      }
      throw new ConflictException('Company slug already exists')
    }

    return this.companyRepository.save(createCompanyDto)
  }

  /**
   * Retrieves all companies from the repository.
   *
   * @returns A promise that resolves to an array of companies.
   */
  async findAll(): Promise<Company[]> {
    return this.companyRepository.find({ relations: ['country', 'city'] })
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
  }

  /**
   * Removes a company by ID.
   *
   * @param {number} companyId - The ID of the company to delete.
   * @returns A promise that resolves to the deletion result.
   */
  async remove(companyId: number) {
    return this.companyRepository.delete({ id: companyId })
  }
}
