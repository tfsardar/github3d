import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Reject any request body/params that don't match our DTOs exactly
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Only our Next.js frontend is allowed to call this API
  app.enableCors({
  origin: true,
});

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Server running on port ${port}`);
}
bootstrap();