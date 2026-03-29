import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'
// import { City } from '../../cities/entities/city.entity';

@Entity({ name: 'countries' })
export class Country {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({
    nullable: false,
    unique: true,
  })
  name!: string

  @Column({
    nullable: false,
  })
  slug!: string

  @Column({
    nullable: true,
  })
  capital?: string

  @Column({
    nullable: true,
    type: 'float',
  })
  latitude?: number

  @Column({
    nullable: true,
    type: 'float',
  })
  longitude?: number

  @Column({
    nullable: true,
    length: 100,
    comment: 'IANA timezone identifier, e.g. Asia/Ho_Chi_Minh',
  })
  timezone?: string | null

  @CreateDateColumn({
    nullable: true,
    name: 'created_at',
  })
  created_at?: Date

  @CreateDateColumn({
    nullable: true,
    name: 'updated_at',
  })
  updated_at?: Date

  @CreateDateColumn({
    nullable: true,
    name: 'deleted_at',
  })
  deleted_at?: Date

  // @HasMany(() => City)
  // cities: City[];
}
