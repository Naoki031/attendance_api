import { Sequelize } from 'sequelize-typescript';
import { SEQUELIZE, DEVELOPMENT, TEST, PRODUCTION } from '../constants/config';
import { databaseConfig } from './database.config';
import { Country } from '../../modules/countries/entities/country.entity';
import { Role } from '../../modules/roles/entities/role.entity';
import { snakeCase } from 'lodash';
// import { City } from '../../cities/entities/city.entity';
// import { Company } from '../../companies/entities/company.entity';
// import { Group } from '../../groups/entities/group.entity';
// import { User } from '../../modules/users/entities/user.entity';

export const databaseProviders = [
  {
    provide: SEQUELIZE,
    useFactory: async () => {
      let config;
      switch (process.env.NODE_ENV) {
        case DEVELOPMENT:
          config = databaseConfig.development;
          break;
        case TEST:
          config = databaseConfig.test;
          break;
        case PRODUCTION:
          config = databaseConfig.production;
          break;
        default:
          config = databaseConfig.development;
          break;
      }

      const sequelize = new Sequelize(config);
      sequelize.addModels([Role, Country]);
      await sequelize.sync();
      return sequelize;
    },
  },
];
