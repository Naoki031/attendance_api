import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Country } from '@/modules/countries/entities/country.entity'
import { City } from '@/modules/cities/entities/city.entity'

@Entity({ name: 'companies' })
export class Company {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, unique: true })
  name!: string

  @Column({ nullable: false })
  slug!: string

  @Column({ nullable: true, name: 'country_id' })
  country_id?: number

  @Column({ nullable: true, name: 'city_id' })
  city_id?: number

  @Column({ nullable: true })
  address?: string

  @Column({ nullable: true })
  phone?: string

  @Column({ nullable: true })
  email?: string

  @Column({ nullable: true })
  website?: string

  @Column({ nullable: true })
  logo?: string

  @Column({ nullable: true, name: 'allowed_ips', type: 'text' })
  allowed_ips?: string | null

  @Column({
    nullable: true,
    name: 'google_calendar_id',
    length: 255,
    comment: 'Google Calendar ID for this company (e.g. xxx@group.calendar.google.com)',
  })
  google_calendar_id?: string | null

  @Column({
    nullable: true,
    name: 'work_start_time',
    type: 'time',
    comment: 'Default work start time for this company',
  })
  work_start_time?: string | null

  @Column({
    nullable: true,
    name: 'work_end_time',
    type: 'time',
    comment: 'Default work end time for this company',
  })
  work_end_time?: string | null

  @ManyToOne(() => Country)
  @JoinColumn({ name: 'country_id' })
  country?: Country

  @ManyToOne(() => City)
  @JoinColumn({ name: 'city_id' })
  city?: City

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @CreateDateColumn({ nullable: true, name: 'updated_at' })
  updated_at?: Date

  @CreateDateColumn({ nullable: true, name: 'deleted_at' })
  deleted_at?: Date
}
