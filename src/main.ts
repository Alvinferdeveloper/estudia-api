import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { dataSource } from './data-source';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
