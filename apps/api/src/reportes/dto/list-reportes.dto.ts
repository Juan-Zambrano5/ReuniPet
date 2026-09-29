import { TipoReporte } from '@reunipet/shared';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  // HU8: filtros de texto combinables (AND), tolerantes a mayúsculas/acentos.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  especie?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  raza?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  color?: string;

  // HU8: filtro de ubicación. Los tres deben enviarse juntos (se valida
  // en el servicio) y usan Haversine sin PostGIS.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  radioKm?: number;
}
