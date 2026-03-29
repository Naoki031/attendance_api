import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CompaniesController } from './companies.controller'
import { CompaniesService } from './companies.service'
import { Company } from './entities/company.entity'
import { CompanyApprover } from './entities/company_approver.entity'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [TypeOrmModule.forFeature([Company, CompanyApprover]), UserGroupPermissionsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
