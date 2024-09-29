import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'permission_groups' })
export class PermissionGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    nullable: false,
    unique: true,
    name: 'name'
  })
  name!: string;

  @Column({
    nullable: false,
    unique: true,
    name: 'permissions'
  })
  permissions!: string;

  @Column({
    nullable: true,
    name: 'descriptions',
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

  @Column({
    nullable: true,
    name: 'deleted_at',
  })
  deleted_at?: Date;
}
