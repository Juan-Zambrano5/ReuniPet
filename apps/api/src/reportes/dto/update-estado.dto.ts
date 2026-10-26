import { IsEnum } from 'class-validator';
import { EstadoReporte } from '@prisma/client';

/** HU11/HU14: PATCH /reportes/:id/estado — cambiar el estado del reporte. */
export class UpdateEstadoDto {
  @IsEnum(EstadoReporte, {
    message: 'El estado debe ser PERDIDA, ENCONTRADA o RECUPERADA',
  })
  estado!: EstadoReporte;
}
