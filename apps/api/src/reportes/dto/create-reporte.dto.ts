import { TipoReporte } from '@reunipet/shared';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
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

  // HU3 AC2: obligatoria solo cuando tipo = ENCONTRADA (PERDIDA opcional en Sprint 1)
  @ValidateIf((dto: CreateReporteDto) => dto.tipo === TipoReporte.ENCONTRADA)
  @IsString({ message: 'La ubicación debe ser un texto' })
  @IsNotEmpty({ message: 'La ubicación es obligatoria para reportes de mascota encontrada' })
  ubicacion?: string;
}
