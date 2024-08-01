import { Country } from './entities/country.entity';
import { COUNTRY_REPOSITORY } from 'src/core/constants/repository';

export const countriesProviders = [
  {
    provide: COUNTRY_REPOSITORY,
    useValue: Country,
  },
];
