import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    try {
      // Si recibimos un string JSON, parsearlo primero
      let dataToValidate = value;
      if (typeof value === 'string') {
        try {
          dataToValidate = JSON.parse(value);
        } catch (parseError) {
          throw new BadRequestException('Invalid JSON format');
        }
      }

      const parsedValue = this.schema.parse(dataToValidate);
      return parsedValue;
    } catch (error) {
      if (error.errors) {
        // Formatear errores de Zod para ser más descriptivos
        const formattedErrors = error.errors.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        console.error('❌ Zod Validation Errors:', JSON.stringify(formattedErrors, null, 2));

        throw new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}