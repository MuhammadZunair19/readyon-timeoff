import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { HcmAppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(HcmAppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.MOCK_HCM_PORT ? Number(process.env.MOCK_HCM_PORT) : 3001;
  await app.listen(port);
  console.log(`HCM Mock Server is running on port ${port}`);
}

void bootstrap();
