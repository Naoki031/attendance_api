import { MySqlDialect } from '@sequelize/mysql';

export interface DBConfigAttributes {
  username?: string;
  password?: string;
  database?: string;
  host?: string;
  port?: number | string;
  dialect?: MySqlDialect;
  urlDatabase?: string;
  define?: any;
}

export interface DBConfig {
  development: DBConfigAttributes;
  test: DBConfigAttributes;
  production: DBConfigAttributes;
}
