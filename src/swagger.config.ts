import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
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
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('employees', 'Employee management endpoints')
    .addTag('master-shift-templates', 'Master shift template endpoints')
    .addTag('sub-shift-templates', 'Sub shift template endpoints')
    .addTag('task-templates', 'Task template endpoints')
    .addTag('master-shifts', 'Generated master shift endpoints')
    .addTag('sub-shifts', 'Generated sub shift endpoints')
    .addTag('assignments', 'Assignment endpoints')
    .addTag('tasks', 'Task endpoints')
    .addTag('time-tracking', 'Time tracking endpoints')
    .addTag('branches', 'Branch management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Apply a global security requirement so Swagger sends the Authorization header
  document.security = [{ 'access-token': [] }];

  return document;
}
