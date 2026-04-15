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
import { EmailTemplatesService } from './email_templates.service'
import { CreateEmailTemplateDto } from './dto/create-email-template.dto'
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('email-templates')
@UseGuards(PermissionsGuard)
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Post()
  @Permissions('all_privileges', 'create')
  create(@Body(ValidationPipe) createDto: CreateEmailTemplateDto) {
    return this.emailTemplatesService.create(createDto)
  }

  @Get('template-keys')
  @Permissions('all_privileges', 'read')
  getTemplateKeys() {
    return this.emailTemplatesService.getTemplateKeys()
  }

  @Get()
  @Permissions('all_privileges', 'read')
  findAll(@Query('company_id') companyId?: string) {
    return this.emailTemplatesService.findAll(companyId ? Number(companyId) : undefined)
  }

  @Get(':id')
  @Permissions('all_privileges', 'read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.emailTemplatesService.findOne(id)
  }

  @Put(':id')
  @Permissions('all_privileges', 'update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateDto: UpdateEmailTemplateDto,
  ) {
    return this.emailTemplatesService.update(id, updateDto)
  }

  @Delete(':id')
  @Permissions('all_privileges', 'delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.emailTemplatesService.remove(id)
  }
}
