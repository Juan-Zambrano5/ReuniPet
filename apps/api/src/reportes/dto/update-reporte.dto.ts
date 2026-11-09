import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * HU17: PATCH /reportes/:id — editar la información del reporte.
 * Solo estos cuatro campos; la ubicación va por PATCH /reportes/:id/ubicacion.
 * tipo, estado, fotos, id o propietarioId en el body → 400 (el ValidationPipe
 * global usa forbidNonWhitelisted).
 */
export class UpdateReporteDto {
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La especie debe ser un texto' })
  @IsNotEmpty({ message: 'La especie no puede quedar vacía' })
  @MaxLength(100)
  especie?: string;

  // La raza es opcional: "" o null la borran.
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La raza debe ser un texto' })
  @MaxLength(100)
  raza?: string | null;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El color debe ser un texto' })
  @IsNotEmpty({ message: 'El color no puede quedar vacío' })
  @MaxLength(100)
  color?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'Las características deben ser un texto' })
  @IsNotEmpty({ message: 'Las características distintivas no pueden quedar vacías' })
  @MaxLength(1000)
  caracteristicasDistintivas?: string;
}
