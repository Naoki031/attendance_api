import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
// import { City } from '../../cities/entities/city.entity';

const snakeCase = (str: string) =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const camelCase = (str: string) =>
  str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

@Entity({ name: 'countries' })
export class Country {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    nullable: false,
    unique: true,
  })
  name!: string;

  @Column({
    nullable: false,
  })
  slug!: string;

  @Column({
    nullable: true,
  })
  capital?: string;

  @Column({
    nullable: true,
    type: 'float',
  })
  latitude?: number;

  @Column({
    nullable: true,
    type: 'float',
  })
  longitude?: number;

  @CreateDateColumn({
    nullable: true,
    name: 'created_at',
  })
  created_at?: Date;

  @CreateDateColumn({
    nullable: true,
    name: 'updated_at',
  })
  updated_at?: Date;

  @CreateDateColumn({
    nullable: true,
    name: 'deleted_at',
  })
  deleted_at?: Date;

  // @HasMany(() => City)
  // cities: City[];
}
