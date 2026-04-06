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
import { CitiesService } from './cities.service'
import { CreateCityDto } from './dto/create-city.dto'
import { UpdateCityDto } from './dto/update-city.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('cities')
@UseGuards(PermissionsGuard)
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Post()
  @Permissions('create')
  create(@Body(ValidationPipe) createCityDto: CreateCityDto) {
    return this.citiesService.create(createCityDto)
  }

  @Get()
  @Permissions('read')
  findAll(@Query('search') search?: string, @Query('country_id') countryId?: string) {
    if (search || countryId) {
      return this.citiesService.findWithFilters({
        search,
        countryId: countryId ? parseInt(countryId, 10) : undefined,
      })
    }

    return this.citiesService.findAll()
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id', ParseIntPipe) cityId: number) {
    return this.citiesService.findOne(cityId)
  }

  @Put(':id')
  @Permissions('update')
  update(
    @Param('id', ParseIntPipe) cityId: number,
    @Body(ValidationPipe) updateCityDto: UpdateCityDto,
  ) {
    return this.citiesService.update(cityId, updateCityDto)
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) cityId: number) {
    return this.citiesService.remove(cityId)
  }
}
