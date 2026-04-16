import { DataSource } from 'typeorm'
import { Seeder, SeederFactoryManager } from 'typeorm-extension'
import { Country } from '../../../modules/countries/entities/country.entity'

const countries: Partial<Country>[] = [
  {
    name: 'Việt Nam',
    slug: 'vietnam',
    capital: 'Hanoi',
    latitude: 21.028511,
    longitude: 105.804817,
  },
]

export default class CountrySeeder implements Seeder {
  public async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const repository = dataSource.getRepository(Country)

    for (const countryData of countries) {
      const existing = await repository.findOne({ where: { slug: countryData.slug } })
      if (!existing) {
        await repository.save(repository.create(countryData))
      }
    }
  }
}
