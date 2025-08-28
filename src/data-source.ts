import { DataSource } from 'typeorm';
import 'dotenv/config';

export const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [
        __dirname + '/typeorm/entities/*.entity{.ts,.js}',
    ],
    migrations: [
        __dirname + '/typeorm/migrations/*.migration{.ts,.js}',
    ],
    synchronize: true,
    timezone: 'Z',
});
