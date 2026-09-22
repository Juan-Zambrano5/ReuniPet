import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Usuario } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const CurrentUserProvider = Symbol('CurrentUserProvider');

export interface CurrentUserProvider {
  getUser(req: Request): Promise<Usuario>;
}

export const DEMO_EMAIL = 'demo@reunipet.app';

@Injectable()
export class HeaderCurrentUserProvider implements CurrentUserProvider {
  constructor(private readonly prisma: PrismaService) {}

  async getUser(req: Request): Promise<Usuario> {
    const headerId = req.headers['x-user-id'];
    const userId = Array.isArray(headerId) ? headerId[0] : headerId;

    if (userId) {
      const user = await this.prisma.usuario.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new UnauthorizedException('Usuario de sesión no válido');
      }
      return user;
    }

    const demo = await this.prisma.usuario.findUnique({
      where: { email: DEMO_EMAIL },
    });
    if (!demo) {
      throw new NotFoundException(
        'Usuario demo no encontrado; ejecuta el seed de la base de datos',
      );
    }
    return demo;
  }
}
