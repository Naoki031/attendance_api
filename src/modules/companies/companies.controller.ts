import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common'
import { CompaniesService } from './companies.service'
import { CreateCompanyDto } from './dto/create-company.dto'
import { UpdateCompanyDto } from './dto/update-company.dto'
import { SetCompanyApproversDto } from './dto/set-company_approvers.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('companies')
@UseGuards(PermissionsGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Permissions('create')
  async create(@Body(ValidationPipe) createCompanyDto: CreateCompanyDto) {
    try {
      return await this.companiesService.create(createCompanyDto)
    } catch (error) {
      console.error('Error creating company:', error)
      throw error
    }
  }

  @Get()
  @Permissions('read')
  findAll(
    @Query('search') search?: string,
    @Query('country_id') countryId?: string,
    @Query('city_id') cityId?: string,
  ) {
    if (search || countryId || cityId) {
      return this.companiesService.findWithFilters({
        search,
        countryId: countryId ? parseInt(countryId, 10) : undefined,
        cityId: cityId ? parseInt(cityId, 10) : undefined,
      })
    }

    return this.companiesService.findAll()
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id', ParseIntPipe) companyId: number) {
    return this.companiesService.findOne(companyId)
  }

  @Put(':id')
  @Permissions('update')
  update(
    @Param('id', ParseIntPipe) companyId: number,
    @Body(ValidationPipe) updateCompanyDto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(companyId, updateCompanyDto)
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) companyId: number) {
    return this.companiesService.remove(companyId)
  }

  @Get(':id/approvers')
  @Permissions('read')
  findApprovers(@Param('id', ParseIntPipe) companyId: number) {
    return this.companiesService.findApprovers(companyId)
  }

  @Put(':id/approvers')
  @Permissions('update')
  setApprovers(
    @Param('id', ParseIntPipe) companyId: number,
    @Body(ValidationPipe) dto: SetCompanyApproversDto,
  ) {
    return this.companiesService.setApprovers(companyId, dto)
  }
}
