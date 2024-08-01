import { Module } from '@nestjs/common';
import { CountriesService } from './countries.service';
import { CountriesController } from './countries.controller';
import { countriesProviders } from './countries.provider';

@Module({
  controllers: [CountriesController],
  providers: [CountriesService, ...countriesProviders],
})
export class CountriesModule {}
