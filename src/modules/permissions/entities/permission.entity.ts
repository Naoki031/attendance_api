import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'permissions' })
export class Permission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    nullable: false,
    unique: true,
  })
  name!: string;

  @Column({
    nullable: false,
    unique: true,
  })
  key!: string;

  @Column({
    nullable: true,
  })
  descriptions?: string;

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
}
