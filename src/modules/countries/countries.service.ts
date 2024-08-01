import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Country } from './entities/country.entity';
import { COUNTRY_REPOSITORY } from 'src/core/constants/repository';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

@Injectable()
export class CountriesService {
  constructor(
    @Inject(COUNTRY_REPOSITORY)
    private readonly countryRepository: typeof Country,
  ) {}

  async create(createCountryDto: CreateCountryDto): Promise<Country> {
    const country = await this.countryRepository.create<Country>({
      ...createCountryDto,
    });

    return country;
  }

  async findAll() {
    const countries = await this.countryRepository.findAll<Country>();
    console.log(countries);
    return this.countryRepository.findAll<Country>();
  }

  findOne(id: number) {
    const country = this.countryRepository.findOne<Country>({ where: { id } });

    if (!country) {
      throw new NotFoundException('Country not found');
    }

    return country;
  }

  async update(
    countryId: number,
    updateCountryDto: UpdateCountryDto,
  ): Promise<Country> {
    await this.countryRepository.update(
      { ...updateCountryDto },
      { where: { id: countryId } },
    );
    const country = this.countryRepository.findOne<Country>({
      where: { id: countryId },
    });

    if (!country) {
      throw new NotFoundException('Country not found');
    }

    return country;
  }

  async remove(id: number) {
    return await this.countryRepository.destroy({ where: { id } });
  }
}
