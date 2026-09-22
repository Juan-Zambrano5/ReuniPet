import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { Response } from 'express';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const message =
      exception.code === 'LIMIT_FILE_SIZE'
        ? 'Cada fotografía debe pesar máximo 5MB'
        : `Error al procesar el archivo: ${exception.message}`;

    response.status(400).json(new BadRequestException(message).getResponse());
  }
}
