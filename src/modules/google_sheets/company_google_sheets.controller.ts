import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common'
import { CompanyGoogleSheetsService } from './company_google_sheets.service'
import { CreateCompanyGoogleSheetDto } from './dto/create-company_google_sheet.dto'
import { UpdateCompanyGoogleSheetDto } from './dto/update-company_google_sheet.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('company-google-sheets')
@UseGuards(PermissionsGuard)
export class CompanyGoogleSheetsController {
  constructor(private readonly companyGoogleSheetsService: CompanyGoogleSheetsService) {}

  @Post()
  @Permissions('create')
  create(@Body(ValidationPipe) createDto: CreateCompanyGoogleSheetDto) {
    return this.companyGoogleSheetsService.create(createDto)
  }

  @Get()
  @Permissions('read')
  findAll() {
    return this.companyGoogleSheetsService.findAll()
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companyGoogleSheetsService.findOne(id)
  }

  @Get(':id/sample-row')
  @Permissions('read')
  getSampleRow(@Param('id', ParseIntPipe) id: number) {
    return this.companyGoogleSheetsService.getSampleRow(id)
  }

  @Put(':id')
  @Permissions('update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateDto: UpdateCompanyGoogleSheetDto,
  ) {
    return this.companyGoogleSheetsService.update(id, updateDto)
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companyGoogleSheetsService.remove(id)
  }
}
