import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * HU12: POST /auth/register.
 * Los mensajes de error nunca incluyen el valor recibido (no exponen la
 * contraseña en respuestas ni en logs).
 */
export class RegisterDto {
  @Transform(trim)
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre admite máximo 100 caracteres' })
  nombre!: string;

  // HU12 AC2: el correo se guarda SIEMPRE normalizado (sin espacios, minúsculas).
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  email!: string;

  @Transform(({ value }: { value: unknown }) => {
    const v = trim({ value });
    return v === '' ? undefined : v;
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un texto' })
  @MaxLength(30, { message: 'El teléfono admite máximo 30 caracteres' })
  telefono?: string;

  // Sin trim: los espacios son parte de la contraseña.
  @IsString({ message: 'La contraseña debe ser un texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'La contraseña admite máximo 128 caracteres' })
  password!: string;
}
