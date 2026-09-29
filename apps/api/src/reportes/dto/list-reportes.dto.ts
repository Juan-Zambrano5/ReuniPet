import { TipoReporte } from '@reunipet/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListReportesDto {
  // HU6: solo listado de PERDIDAS. HU7 amplía a ENCONTRADA.
  @IsOptional()
  @IsIn([TipoReporte.PERDIDA], {
    message: 'tipo debe ser PERDIDA (por ahora solo reportes perdidos)',
  })
  tipo?: TipoReporte;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
