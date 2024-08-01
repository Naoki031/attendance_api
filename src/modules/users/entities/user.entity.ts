import { Table, Column, Model, HasMany, DataType } from 'sequelize-typescript';

@Table({
  timestamps: true,
  underscored: true,
  tableName: 'users',
})
export class User extends Model {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  userId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  username: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  firstName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  lastName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  position: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  phoneNumber: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  email: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  address: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  password: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  isActive: boolean;

  @Column({
    type: DataType.JSON,
    allowNull: false,
  })
  roles: string[];

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  avatar: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  dateOfBirth?: any;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  joinDate?: any;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  contractSignDate?: any;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  contractExpireDate?: any;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  contractType?: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  contractCount?: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  createdAt?: any;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  updatedAt?: any;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  deletedAt?: any;
}
