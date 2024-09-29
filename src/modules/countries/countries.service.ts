import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from './entities/country.entity';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {}

  async create(createCountryDto: CreateCountryDto): Promise<Country> {
    const country = this.countryRepository.save(createCountryDto);

    return country;
  }

  async findAll(): Promise<Country[]> {
    const countries = await this.countryRepository.find();
    return countries;
  }

  findOne(id: number): Promise<Country> {
    const country = this.countryRepository.findOne({ where: { id } });

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
      { id: countryId },
      { ...updateCountryDto },
    );

    const country = this.findOne(countryId);

    if (!country) {
      throw new NotFoundException('Country not found');
    }

    return country;
  }

  async delete(id: number) {
    return await this.countryRepository.delete({ id });
  }
}
