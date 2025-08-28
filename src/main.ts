import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { dataSource } from './data-source';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
