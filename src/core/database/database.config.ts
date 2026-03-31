import * as dotenv from 'dotenv'

dotenv.config()

export const databaseConfig = {
  type: ((process.env.DB_DIALECT as string) || 'mysql') as 'mysql' | 'mariadb',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || '',
  username: process.env.DB_USER || '',
  password: process.env.DB_PASS || '',
  connectTimeout: 60000,
  logging: process.env.NODE_ENV !== 'production',
  synchronize: false,
  timezone: '+00:00',
}
