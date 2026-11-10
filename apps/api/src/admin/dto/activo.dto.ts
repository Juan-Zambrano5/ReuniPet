import { IsBoolean } from 'class-validator';

/** HU19: PATCH /admin/usuarios/:id/activo. */
export class ActivoDto {
  @IsBoolean({ message: 'activo debe ser true o false' })
  activo!: boolean;
}
