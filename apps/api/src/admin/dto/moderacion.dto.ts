import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** HU18: PATCH /admin/reportes/:id/moderacion. */
export class ModeracionDto {
  @IsBoolean({ message: 'moderado debe ser true o false' })
  moderado!: boolean;

  // Obligatorio al ocultar (AC1: "con un motivo"); se ignora al restaurar.
  @ValidateIf((o: ModeracionDto) => o.moderado === true)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El motivo es obligatorio para ocultar el reporte' })
  @IsNotEmpty({ message: 'El motivo es obligatorio para ocultar el reporte' })
  @MaxLength(500)
  motivo?: string;
}
