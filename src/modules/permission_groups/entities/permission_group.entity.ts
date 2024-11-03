import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad,
} from 'typeorm';

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
