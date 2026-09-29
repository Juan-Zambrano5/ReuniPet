import { TipoReporte } from '@reunipet/shared';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListReportesDto {
  // HU6/HU7: PERDIDA y ENCONTRADA. Sin tipo = ambos tipos.
  @IsOptional()
  @IsEnum(TipoReporte, { message: 'tipo debe ser PERDIDA o ENCONTRADA' })
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
