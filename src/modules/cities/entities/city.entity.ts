import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Country } from '@/modules/countries/entities/country.entity'

@Entity({ name: 'cities' })
export class City {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, name: 'country_id' })
  country_id!: number

  @Column({ nullable: false, unique: true })
  name!: string

  @Column({ nullable: false, unique: true })
  slug!: string

  @Column({ nullable: true, name: 'is_capital', type: 'boolean' })
  is_capital?: boolean

  @Column({ nullable: true, type: 'float' })
  latitude?: number

  @Column({ nullable: true, type: 'float' })
  longitude?: number

  @ManyToOne(() => Country)
  @JoinColumn({ name: 'country_id' })
  country?: Country

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @CreateDateColumn({ nullable: true, name: 'updated_at' })
  updated_at?: Date

  @CreateDateColumn({ nullable: true, name: 'deleted_at' })
  deleted_at?: Date
}
