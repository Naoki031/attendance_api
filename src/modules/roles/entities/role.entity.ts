import { Table, Column, Model, HasMany, DataType } from 'sequelize-typescript';

@Table({
  timestamps: true,
  underscored: true,
  tableName: 'roles',
})
export class Role extends Model<Role> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  role_id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  key: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  descriptions: string;

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
