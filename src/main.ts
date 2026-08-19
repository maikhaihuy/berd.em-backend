import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { buildOpenApiDocument } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api'); // Set global prefix for all routes
  const configService = app.get(ConfigService);

  // If you rely on cookies for refresh, ensure CORS is configured correctly:
  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation setup
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      // Keeps the Authorization token across page refreshes in Swagger UI
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}/api`);
  console.log(`Swagger documentation: http://localhost:${port}/docs`);
}

void bootstrap();
