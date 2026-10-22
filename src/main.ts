import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { dataSource } from './data-source';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.useLogger(new Logger());
  app.useGlobalFilters(new AllExceptionsFilter());
  // Without it the DTO decorators are inert; whitelist drops fields a DTO doesn't declare.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const requestLogger = new RequestLoggerMiddleware();
  app.use(requestLogger.use.bind(requestLogger));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3100',
    credentials: true,
  });

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
