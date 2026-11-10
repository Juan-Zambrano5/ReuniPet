import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RolUsuario, Usuario } from '@prisma/client';
import {
  AdminUsuarioItem,
  RolUsuario as SharedRolUsuario,
} from '@reunipet/shared';
import { PrismaService } from '../prisma/prisma.service';

export const NO_SUSPENDER_A_SI_MISMO = 'No puedes suspender tu propia cuenta';
export const NO_SUSPENDER_ADMIN = 'No se puede suspender a un administrador';

// Campos que salen al administrador: nunca passwordHash.
const SELECCION = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  createdAt: true,
  _count: { select: { reportes: true } },
} as const;

type UsuarioSeleccionado = Pick<
  Usuario,
  'id' | 'nombre' | 'email' | 'rol' | 'activo' | 'createdAt'
> & { _count: { reportes: number } };

function aItem(u: UsuarioSeleccionado): AdminUsuarioItem {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol as SharedRolUsuario,
    activo: u.activo,
    createdAt: u.createdAt.toISOString(),
    totalReportes: u._count.reportes,
  };
}

/** HU19: lista y suspende/reactiva usuarios (solo AdminController). */
@Injectable()
export class AdminUsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** shortcut: sin paginación; agregarla si crece el número de usuarios. */
  async listar(): Promise<AdminUsuarioItem[]> {
    const usuarios = await this.prisma.usuario.findMany({
      select: SELECCION,
      orderBy: { createdAt: 'desc' },
    });
    return usuarios.map(aItem);
  }

  /**
   * Suspende (activo=false) o reactiva. Idempotente: si ya está en ese
   * estado responde sin escribir. No se suspende a uno mismo ni a un ADMIN.
   */
  async cambiarActivo(
    id: string,
    activo: boolean,
    admin: Usuario,
  ): Promise<AdminUsuarioItem> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: SELECCION,
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    if (!activo) {
      if (usuario.id === admin.id) {
        throw new BadRequestException(NO_SUSPENDER_A_SI_MISMO);
      }
      if (usuario.rol === RolUsuario.ADMIN) {
        throw new BadRequestException(NO_SUSPENDER_ADMIN);
      }
    }

    if (usuario.activo === activo) return aItem(usuario);

    return aItem(
      await this.prisma.usuario.update({
        where: { id },
        data: { activo },
        select: SELECCION,
      }),
    );
  }
}
