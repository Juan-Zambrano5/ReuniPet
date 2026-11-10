import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { RolUsuario, Usuario } from '@prisma/client';
import { Request } from 'express';
import { CurrentUserProvider } from '../usuarios/current-user.provider';

export const SOLO_ADMIN = 'Solo un administrador puede hacer esto';

/** Request con el usuario que dejó AdminGuard. */
export type AdminRequest = Request & { admin: Usuario };

/**
 * HU18 AC3: sin sesión → 401; con sesión pero sin rol ADMIN → 403. Corre
 * antes de validar el body, así que un usuario normal nunca ve más que el 403.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(CurrentUserProvider)
    private readonly currentUser: CurrentUserProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const user = await this.currentUser.getUser(req);
    if (user.rol !== RolUsuario.ADMIN) {
      throw new ForbiddenException(SOLO_ADMIN);
    }
    req.admin = user;
    return true;
  }
}
