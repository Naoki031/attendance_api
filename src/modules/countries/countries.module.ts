import { Module } from '@nestjs/common';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { countriesProviders } from './countries.provider';
import { Country } from './entities/country.entity';
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Country]), UserGroupPermissionsModule],
  controllers: [CountriesController],
  providers: [CountriesService, ...countriesProviders],
})
export class CountriesModule {}
