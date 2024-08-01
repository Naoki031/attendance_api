import * as dotenv from 'dotenv';
import { DBConfig } from './interfaces/db-config.interface';

dotenv.config();

export const databaseConfig: DBConfig = {
  development: {
    username: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME_DEVELOPMENT || '',
    host: process.env.DB_HOST || '',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: process.env.DB_DIALECT as any || 'mysql',
    define: {
      underscored: true,
      underscoredAll: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  test: {
    username: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME_TEST || '',
    host: process.env.DB_HOST || '',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: process.env.DB_DIALECT as any || 'mysql',
    define: {
      underscored: true,
      underscoredAll: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  production: {
    username: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME_PRODUCTION || '',
    host: process.env.DB_HOST || '',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: process.env.DB_DIALECT as any || 'mysql',
    define: {
      underscored: true,
      underscoredAll: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
};
