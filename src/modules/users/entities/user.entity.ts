import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    nullable: false,
    unique: true,
    name: 'username',
  })
  username!: string;

  @Column({
    nullable: false,
    name: 'first_name',
  })
  first_name!: string;

  @Column({
    nullable: false,
    name: 'last_name',
  })
  last_name!: string;

  @Column({
    nullable: true,
    name: 'position',
  })
  position?: string;

  @Column({
    nullable: true,
    name: 'phone_number',
  })
  phone_number?: string;

  @Column({
    nullable: false,
    unique: true,
    name: 'email',
  })
  email?: string;

  @Column({
    nullable: true,
    name: 'address',
  })
  address?: string;

  @Column({
    nullable: false,
    name: 'password',
  })
  password!: string;

  @Column({
    nullable: false,
    name: 'is_activated',
  })
  is_activated!: boolean;

  @Column({
    nullable: false,
    name: 'roles',
  })
  roles!: string;
  
  @Column({
    nullable: true,
    name: 'avatar',
  })
  avatar?: string;

  @Column({
    nullable: true,
    name: 'date_of_birth',
  })
  date_of_birth?: string;

  @Column({
    nullable: true,
    name: 'join_date',
  })
  join_date?: string;

  @Column({
    nullable: true,
    name: 'contract_signed_date',
  })
  contract_signed_date?: string;

  @Column({
    nullable: true,
    name: 'contract_expired_date',
  })
  contract_expired_date?: string;

  @Column({
    nullable: true,
    name: 'contract_type',
  })
  contract_type?: string;

  @Column({
    nullable: true,
    name: 'contract_count',
  })
  contract_count?: number;

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
}
