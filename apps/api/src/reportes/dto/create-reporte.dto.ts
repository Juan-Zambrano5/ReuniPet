import { TipoReporte } from '@reunipet/shared';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
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

  @IsString()
  @IsOptional()
  ubicacion?: string;
}
