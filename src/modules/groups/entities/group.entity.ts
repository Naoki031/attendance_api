import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity({ name: 'groups' })
export class Group {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ nullable: false, unique: true, length: 100 })
  name!: string

  @Column({ nullable: false, unique: true, length: 100 })
  slug!: string

  @Column({ nullable: true, length: 100 })
  descriptions?: string

  @Column({ nullable: true, name: 'slack_channel_id', length: 50 })
  slack_channel_id?: string

  @Column({ nullable: true, name: 'slack_user_group_id', length: 50 })
  slack_user_group_id?: string

  @Column({ nullable: true, name: 'company_id' })
  company_id?: number

  @CreateDateColumn({ nullable: true, name: 'created_at' })
  created_at?: Date

  @CreateDateColumn({ nullable: true, name: 'updated_at' })
  updated_at?: Date

  @CreateDateColumn({ nullable: true, name: 'deleted_at' })
  deleted_at?: Date
}
