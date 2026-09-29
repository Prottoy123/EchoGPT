import {
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Reusable NestJS Pipe for runtime request payload validation using Zod
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') {
      return value;
    }

    const result = this.schema.safeParse(value);

    if (!result.success) {
      const zodError = result.error as ZodError;
      const issues = (zodError as any).issues || (zodError as any).errors || [];
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Zod validation failed for chat request',
        details: issues.map((err: any) => ({
          field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
          code: err.code,
          message: err.message,
        })),
      });
    }

    return result.data;
  }
}
