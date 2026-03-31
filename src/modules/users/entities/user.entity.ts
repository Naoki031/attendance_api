import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm'
import { UserGroupPermission } from '@/modules/user_group_permissions/entities/user_group_permission.entity'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { UserWorkSchedule } from '@/modules/user_work_schedules/entities/user_work_schedule.entity'
import { Exclude, Expose } from 'class-transformer'

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({
    nullable: false,
    unique: true,
    name: 'username',
  })
  username!: string

  @Column({
    nullable: false,
    name: 'first_name',
  })
  first_name!: string

  @Column({
    nullable: false,
    name: 'last_name',
  })
  last_name!: string

  @Column({
    nullable: true,
    name: 'position',
  })
  position?: string

  @Column({
    nullable: true,
    name: 'phone_number',
  })
  phone_number?: string

  @Column({
    nullable: false,
    unique: true,
    name: 'email',
  })
  email?: string

  @Column({
    nullable: true,
    name: 'address',
  })
  address?: string

  @Exclude()
  @Column({
    nullable: false,
    name: 'password',
  })
  password!: string

  @Column({
    nullable: false,
    name: 'is_activated',
  })
  is_activated!: boolean

  @Column({
    nullable: true,
    name: 'avatar',
  })
  avatar?: string

  @Column({
    nullable: true,
    name: 'date_of_birth',
  })
  date_of_birth?: string

  @Column({
    nullable: true,
    name: 'join_date',
  })
  join_date?: string

  @Column({
    nullable: true,
    name: 'contract_signed_date',
  })
  contract_signed_date?: string

  @Column({
    nullable: true,
    name: 'contract_expired_date',
  })
  contract_expired_date?: string

  @Column({
    nullable: true,
    name: 'contract_type',
  })
  contract_type?: string

  @Column({
    nullable: true,
    name: 'contract_count',
  })
  contract_count?: number

  @Column({
    nullable: true,
    name: 'slack_id',
  })
  slack_id?: string

  @Column({
    nullable: true,
    name: 'device_user_id',
    type: 'int',
    comment: 'ZKTeco device user ID for attendance sync',
  })
  device_user_id?: number | null

  @Column({
    nullable: true,
    name: 'preferred_language',
    default: 'en',
    comment: 'UI language preference: en | vi | ja',
  })
  preferred_language?: string

  @Column({
    nullable: true,
    name: 'fcm_token',
    type: 'text',
    comment: 'Firebase Cloud Messaging token for push notifications',
  })
  fcm_token?: string

  @Column({
    nullable: false,
    name: 'skip_attendance',
    default: false,
    comment: 'When true, exclude user from attendance tracking (auto-fill absences, device sync)',
  })
  skip_attendance!: boolean

  @Column({
    nullable: false,
    name: 'permanent_remote',
    default: false,
    comment: 'User has permanent remote/work from home privilege, no daily WFH request needed',
  })
  permanent_remote!: boolean

  @Column({
    nullable: true,
    name: 'permanent_remote_reason',
    type: 'text',
    comment: 'Reason for permanent remote privilege (e.g., Sales team, Pregnancy accommodation)',
  })
  permanent_remote_reason?: string

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

  @Exclude()
  @CreateDateColumn({
    nullable: true,
    name: 'deleted_at',
  })
  deleted_at?: Date

  @Exclude()
  @OneToMany(() => UserGroupPermission, (userGroupPermission) => userGroupPermission.user)
  user_group_permissions?: UserGroupPermission[]

  @OneToMany(() => UserDepartment, (userDepartment) => userDepartment.user)
  user_departments?: UserDepartment[]

  @OneToMany(() => UserWorkSchedule, (userWorkSchedule) => userWorkSchedule.user)
  user_work_schedules?: UserWorkSchedule[]

  @Expose()
  get full_name(): string {
    return `${this.first_name} ${this.last_name}`
  }

  @Expose()
  get roles(): string[] {
    if (!this.user_group_permissions) return []
    return this.user_group_permissions
      .map((userGroupPermission) => userGroupPermission.permission_group?.name)
      .filter((name): name is string => !!name)
  }

  @Expose()
  get permission_group_ids(): number[] {
    if (!this.user_group_permissions) return []
    return this.user_group_permissions.map(
      (userGroupPermission) => userGroupPermission.permission_group_id,
    )
  }
}
