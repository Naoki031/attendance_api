import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  CompanyGoogleSheet,
  ColumnConfigItem,
  REQUEST_TYPE_ALL,
} from './entities/company_google_sheet.entity'
import { CreateCompanyGoogleSheetDto } from './dto/create-company_google_sheet.dto'
import { UpdateCompanyGoogleSheetDto } from './dto/update-company_google_sheet.dto'
import { DEFAULT_COLUMN_CONFIG } from './google_sheets.service'

@Injectable()
export class CompanyGoogleSheetsService {
  constructor(
    @InjectRepository(CompanyGoogleSheet)
    private readonly companyGoogleSheetRepository: Repository<CompanyGoogleSheet>,
  ) {}

  /**
   * Creates a Google Sheet configuration for a company + request type pair.
   * Each company+request_type combination must be unique.
   */
  async create(createDto: CreateCompanyGoogleSheetDto): Promise<CompanyGoogleSheet> {
    const requestType = createDto.request_type ?? REQUEST_TYPE_ALL
    const existing = await this.companyGoogleSheetRepository.findOne({
      where: { company_id: createDto.company_id, request_type: requestType },
    })
    if (existing) {
      throw new ConflictException(
        `Google Sheet configuration already exists for this company and request type '${requestType}'`,
      )
    }
    return this.companyGoogleSheetRepository.save({
      ...createDto,
      request_type: requestType,
      sheet_name: createDto.sheet_name ?? 'Leave Requests',
      is_active: createDto.is_active ?? true,
    })
  }

  /**
   * Retrieves all company Google Sheet configurations with company relation.
   */
  findAll(): Promise<CompanyGoogleSheet[]> {
    return this.companyGoogleSheetRepository.find({
      relations: ['company'],
      order: { id: 'ASC' },
    })
  }

  /**
   * Retrieves a single configuration by ID.
   */
  async findOne(id: number): Promise<CompanyGoogleSheet> {
    const item = await this.companyGoogleSheetRepository.findOne({
      where: { id },
      relations: ['company'],
    })
    if (!item) throw new NotFoundException('Google Sheet configuration not found')
    return item
  }

  /**
   * Retrieves all active configurations for a specific company.
   */
  findByCompany(companyId: number): Promise<CompanyGoogleSheet[]> {
    return this.companyGoogleSheetRepository.find({
      where: { company_id: companyId, is_active: true },
      order: { request_type: 'ASC' },
    })
  }

  /**
   * Returns a sample data row using the column config of the given sheet config.
   * Useful for previewing the column mapping before saving.
   */
  async getSampleRow(id: number): Promise<{ headers: string[]; sample: (string | number)[] }> {
    const item = await this.findOne(id)
    const columnConfig: ColumnConfigItem[] = item.column_config ?? DEFAULT_COLUMN_CONFIG

    const sorted = [...columnConfig].sort((itemA, itemB) => {
      const indexA = this.columnToIndex(itemA.column)
      const indexB = this.columnToIndex(itemB.column)
      return indexA - indexB
    })

    const headers = sorted.map((item) => `${item.column}: ${item.header}`)
    const sample = sorted.map((item) => `[${item.field}]`)

    return { headers, sample }
  }

  private columnToIndex(col: string): number {
    let index = 0
    for (let position = 0; position < col.length; position++) {
      index = index * 26 + (col.toUpperCase().charCodeAt(position) - 64)
    }
    return index - 1
  }

  /**
   * Updates a configuration by ID.
   */
  async update(id: number, updateDto: UpdateCompanyGoogleSheetDto): Promise<CompanyGoogleSheet> {
    await this.findOne(id)
    await this.companyGoogleSheetRepository.update({ id }, { ...updateDto })
    return this.findOne(id)
  }

  /**
   * Removes a configuration by ID.
   */
  async remove(id: number) {
    await this.findOne(id)
    return this.companyGoogleSheetRepository.delete({ id })
  }
}
