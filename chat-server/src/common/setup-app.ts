import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { TransformInterceptor } from './transform.interceptor';

export function setupApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException(flattenValidationErrors(errors)),
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
}

function flattenValidationErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => {
    const current = error.constraints ? Object.values(error.constraints) : [];
    const children = error.children?.length
      ? flattenValidationErrors(error.children)
      : [];
    return [...current, ...children];
  });
}
