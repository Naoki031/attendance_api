import * as dotenv from 'dotenv';
import { DBConfig } from './interfaces/db-config.interface';

dotenv.config();
console.log('process.env.NODE_ENV', process.env.DB_HOST);
export const databaseConfig: DBConfig = {
  development: {
    type: (process.env.DB_DIALECT as any) || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME_DEVELOPMENT || '',
    username: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    connectTimeout: 60000,
    logging: true,
    synchronize: false,
    // maxQueryExecutionTime: 1000,
  },

  production: {
    type: (process.env.DB_DIALECT as any) || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME_PRODUCTION || '',
    username: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    connectTimeout: 60000,
    logging: false,
    synchronize: false,
  },
};
