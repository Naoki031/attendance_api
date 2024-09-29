export interface DBConfigAttributes {
  type: string;
  host?: string;
  port?: number | string;
  database?: string;
  username?: string;
  password?: string;
  entities?: string[];
  migrations?: string[];
  migrationsTableName?: string;
  synchronize?: boolean;
  connectTimeout?: number;
  logging?: boolean;
  maxQueryExecutionTime?: number;
}

export interface DBConfig {
  development: DBConfigAttributes;
  production: DBConfigAttributes;
}
