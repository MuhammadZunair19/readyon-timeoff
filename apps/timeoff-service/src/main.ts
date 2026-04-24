import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TimeOffExceptionFilter } from './shared/timeoff-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new TimeOffExceptionFilter());

  const port = process.env['PORT'] ? Number(process.env['PORT']) : 3000;
  await app.listen(port);
}

void bootstrap();

