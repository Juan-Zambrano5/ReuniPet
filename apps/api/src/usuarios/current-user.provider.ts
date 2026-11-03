import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Usuario } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SESION_INVALIDA, TokenService } from '../auth/token.service';

export const CurrentUserProvider = Symbol('CurrentUserProvider');

export interface CurrentUserProvider {
  /** Usuario de la sesión; 401 si no hay sesión o no es válida. */
  getUser(req: Request): Promise<Usuario>;
  /**
   * Rutas públicas (listado y detalle): null si no hay sesión. Una sesión
   * PRESENTE pero inválida o vencida sigue siendo 401, para que el frontend
   * la limpie y muestre "Tu sesión expiró".
   */
  getOptionalUser(req: Request): Promise<Usuario | null>;
}

export const DEMO_EMAIL = 'demo@reunipet.app';
export const SESION_REQUERIDA = 'Inicia sesión para continuar';

/**
 * X-User-Id (la sesión simulada de los Sprints 1-3) solo se acepta con
 * AUTH_MODE=dev y nunca con NODE_ENV=production. Sirve para probar la API a
 * mano; ninguna prueba ni el frontend dependen de él.
 */
export function modoDevActivo(): boolean {
  return (
    process.env.AUTH_MODE === 'dev' && process.env.NODE_ENV !== 'production'
  );
}

/**
 * HU16: resuelve el usuario desde `Authorization: Bearer <JWT>`. Ya no hay
 * vuelta implícita al usuario demo: sin token no hay usuario.
 */
@Injectable()
export class JwtCurrentUserProvider implements CurrentUserProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async getUser(req: Request): Promise<Usuario> {
    const user = await this.resolver(req);
    if (!user) throw new UnauthorizedException(SESION_REQUERIDA);
    return user;
  }

  getOptionalUser(req: Request): Promise<Usuario | null> {
    return this.resolver(req);
  }

  private async resolver(req: Request): Promise<Usuario | null> {
    const authorization = req.headers.authorization;
    if (authorization) {
      const [esquema, token] = authorization.split(' ');
      if (esquema !== 'Bearer' || !token) {
        throw new UnauthorizedException(SESION_INVALIDA);
      }
      return this.buscar(await this.tokens.verificar(token));
    }

    if (modoDevActivo()) {
      const headerId = req.headers['x-user-id'];
      const userId = Array.isArray(headerId) ? headerId[0] : headerId;
      if (userId) return this.buscar(userId);
    }

    return null;
  }

  // Un token válido de un usuario que ya no existe también es 401.
  private async buscar(id: string): Promise<Usuario> {
    const user = await this.prisma.usuario.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException(SESION_INVALIDA);
    return user;
  }
}
