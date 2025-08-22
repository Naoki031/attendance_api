import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad,
  OneToMany,
} from 'typeorm';
import { UserGroupPermission } from '@/modules/user_group_permissions/entities/user_group_permission.entity';

@Entity({ name: 'permission_groups' })
export class PermissionGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    nullable: false,
    unique: true,
    name: 'name',
  })
  name!: string;

  @Column({
    type: 'text', // Đảm bảo lưu JSON dưới dạng chuỗi
    nullable: false,
    name: 'permissions',
  })
  permissions!: string | string[];

  @Column({
    nullable: true,
    name: 'descriptions',
  })
  descriptions?: string;

  @CreateDateColumn({
    name: 'created_at',
  })
  created_at?: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updated_at?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'deleted_at',
  })
  deleted_at?: Date;

  @OneToMany(() => UserGroupPermission, (userGroupPermission) => userGroupPermission.permission_group)
  user_group_permissions: UserGroupPermission[];

  @BeforeInsert()
  @BeforeUpdate()
  convertPermissionsToString() {
    if (Array.isArray(this.permissions)) {
      this.permissions = JSON.stringify(this.permissions);
    }
  }

  @AfterLoad()
  parsePermissions() {
    if (typeof this.permissions === 'string') {
      try {
        this.permissions = JSON.parse(this.permissions);
      } catch (error) {
        console.error('Failed to parse permissions:', error);
        throw error;
      }
    }
  }
}
