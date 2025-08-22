import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '@/modules/users/entities/user.entity';
import { PermissionGroup } from '@/modules/permission_groups/entities/permission_group.entity';

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

  @ManyToOne(() => User, (user) => user.user_group_permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => PermissionGroup, (group) => group.user_group_permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_group_id' })
  permission_group: PermissionGroup;
}
