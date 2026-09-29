import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** HU9: PATCH /reportes/:id/ubicacion — actualizar el punto del reporte. */
export class UpdateUbicacionDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90, { message: 'La latitud debe estar entre -90 y 90' })
  @Max(90, { message: 'La latitud debe estar entre -90 y 90' })
  latitud!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180, { message: 'La longitud debe estar entre -180 y 180' })
  @Max(180, { message: 'La longitud debe estar entre -180 y 180' })
  longitud!: number;

  // Texto de referencia (opcional): si viene, se actualiza junto al punto.
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser un texto' })
  @IsNotEmpty({ message: 'La ubicación no puede estar vacía' })
  @MaxLength(300)
  ubicacion?: string;
}
