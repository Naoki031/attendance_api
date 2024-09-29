import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'user_group_permissions' })
export class UserGroupPermission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    nullable: false,
    name: 'user_id',
  })
  user_id!: number;

  @Column({
    nullable: false,
    name: 'permission_group_id',
  })
  permission_group_id!: number;

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
