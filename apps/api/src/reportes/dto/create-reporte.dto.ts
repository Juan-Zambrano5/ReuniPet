import { TipoReporte } from '@reunipet/shared';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateReporteDto {
  @IsEnum(TipoReporte)
  tipo!: TipoReporte;

  @IsString()
  @IsNotEmpty({ message: 'La especie es obligatoria' })
  especie!: string;

  @IsString()
  @IsOptional()
  raza?: string;

  @IsString()
  @IsNotEmpty({ message: 'El color es obligatorio' })
  color!: string;

  @IsString()
  @IsNotEmpty({ message: 'Las características distintivas son obligatorias' })
  caracteristicasDistintivas!: string;

  // HU3 AC2 + HU9 AC1: ENCONTRADA exige ubicación, salvo que el usuario
  // haya marcado un punto en el mapa (entonces las coordenadas la sustituyen).
  @ValidateIf(
    (dto: CreateReporteDto) =>
      dto.tipo === TipoReporte.ENCONTRADA &&
      dto.latitud === undefined &&
      dto.longitud === undefined,
  )
  @IsString({ message: 'La ubicación debe ser un texto' })
  @IsNotEmpty({ message: 'La ubicación es obligatoria para reportes de mascota encontrada' })
  ubicacion?: string;

  // HU9 AC2: coordenadas opcionales, siempre en par (se valida en el service).
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90)
  @Max(90)
  latitud?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180)
  @Max(180)
  longitud?: number;
}
