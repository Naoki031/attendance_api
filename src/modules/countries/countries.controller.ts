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
import { CountriesService } from './countries.service'
import { CreateCountryDto } from './dto/create-country.dto'
import { UpdateCountryDto } from './dto/update-country.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('countries')
@UseGuards(PermissionsGuard)
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Post()
  @Permissions('create')
  create(@Body(ValidationPipe) createCountryDto: CreateCountryDto) {
    return this.countriesService.create(createCountryDto)
  }

  @Get()
  @Permissions('read')
  findAll(@Query('search') search?: string) {
    if (search) {
      return this.countriesService.findWithFilters({ search })
    }

    return this.countriesService.findAll()
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id', ParseIntPipe) countryId: string) {
    return this.countriesService.findOne(+countryId)
  }

  @Put(':id')
  @Permissions('update')
  update(
    @Param('id', ParseIntPipe) countryId: number,
    @Body(ValidationPipe) updateCountryDto: UpdateCountryDto,
  ) {
    return this.countriesService.update(countryId, updateCountryDto)
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) countryId: number) {
    return this.countriesService.remove(countryId)
  }
}
