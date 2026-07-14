import { DataSourceOptions } from 'typeorm';

/**
 * Managed Postgres providers (Render, Railway, Heroku) hand out a single
 * DATABASE_URL and require TLS. Locally we run against docker-compose with
 * discrete DB_* variables and no TLS, so support both.
 */
export function databaseConfig(): DataSourceOptions {
  const url = process.env.DATABASE_URL;

  if (url) {
    return {
      type: 'postgres',
      url,
      // Managed providers terminate TLS with their own CA, hence no verification.
      // DATABASE_SSL=false opts out, e.g. when pointing a URL at a local database.
      ssl:
        process.env.DATABASE_SSL === 'false'
          ? false
          : { rejectUnauthorized: false },
    };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
}
