import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Country } from '../../../modules/countries/entities/country.entity';

export default class CountrySeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(Country);

    await repository.insert([
      {
        name: 'United States',
        slug: 'united-states',
        capital: 'Washington D.C.',
        latitude: 38.897957,
        longitude: -77.03656,
      },

      {
        name: 'Canada',
        slug: 'canada',
        capital: 'Ottawa',
        latitude: 45.42153,
        longitude: -75.697193,
      },

      {
        name: 'United Kingdom',
        slug: 'united-kingdom',
        capital: 'London',
        latitude: 51.507351,
        longitude: -0.127758,
      },

      {
        name: 'Australia',
        slug: 'australia',
        capital: 'Canberra',
        latitude: -35.280937,
        longitude: 149.130009,
      },

      {
        name: 'Germany',
        slug: 'germany',
        capital: 'Berlin',
        latitude: 52.520008,
        longitude: 13.404954,
      },
    ]);
  }
}
