import dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { databaseConfig } from './database.config';

dotenv.config();

export default new DataSource({
  ...databaseConfig(),
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
