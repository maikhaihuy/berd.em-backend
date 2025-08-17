import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  const config = new DocumentBuilder()
    .setTitle('Employee Shift & Payroll Management API')
    .setDescription(
      'API for managing employee shifts, time tracking, and payroll',
    )
    .setVersion('1.0')
    // Access token scheme
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Click Authorize and paste ONLY the JWT (do not include "Bearer ").',
      },
      'access-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Refresh token',
      },
      'jwt-refresh',
    )
    // Refresh token via cookie (Option B)
    // .addCookieAuth('refreshToken', {
    //   type: 'apiKey',
    //   in: 'cookie',
    //   description: 'Refresh token cookie',
    // })
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('employees', 'Employee management endpoints')
    .addTag('shifts', 'Shift management endpoints')
    .addTag('time-tracking', 'Time tracking endpoints')
    .addTag('branches', 'Branch management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Apply a global security requirement so Swagger sends the Authorization header
  document.security = [{ 'access-token': [] }];
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      // Keeps the Authorization token across page refreshes in Swagger UI
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation: http://localhost:${port}/api`);
}

bootstrap();
