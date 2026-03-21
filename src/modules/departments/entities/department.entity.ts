import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity({ name: 'departments' })
export class Department {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, unique: true, length: 100 })
  name!: string

  @Column({ nullable: false, unique: true, length: 100 })
  slug!: string

  @Column({ nullable: true, length: 100 })
  descriptions?: string

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @CreateDateColumn({ nullable: true, name: 'updated_at' })
  updated_at?: Date

  @CreateDateColumn({ nullable: true, name: 'deleted_at' })
  deleted_at?: Date
}
