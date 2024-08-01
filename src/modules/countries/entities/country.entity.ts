import {
  Table,
  Column,
  Model,
  DataType,
} from 'sequelize-typescript';

// import { City } from '../../cities/entities/city.entity';

@Table({
  timestamps: true,
  underscored: true,
  tableName: 'countries',
})
export class Country extends Model<Country> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'country_id',
  })
  countryId!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  slug!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  code?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  capital?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  latitude?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  longitude?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'created_at',
  })
  createdAt?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'updated_at',
  })
  updatedAt?: Date;

  // @HasMany(() => City)
  // cities: City[];
}
