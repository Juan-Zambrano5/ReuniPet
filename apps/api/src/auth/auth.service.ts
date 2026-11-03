import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsuarioPublicoResponse } from '@reunipet/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { hashPassword } from './password-hasher';

export const CORREO_DUPLICADO = 'El correo ya está registrado';

// Campos públicos: la respuesta NUNCA incluye passwordHash.
const USUARIO_PUBLICO = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<UsuarioPublicoResponse> {
    // El DTO ya normaliza; se repite aquí para no depender del pipe.
    const email = dto.email.trim().toLowerCase();

    // AC2: insensible a mayúsculas también frente a correos ya existentes.
    const existente = await this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existente) throw new ConflictException(CORREO_DUPLICADO);

    const passwordHash = await hashPassword(dto.password);

    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          nombre: dto.nombre,
          email,
          telefono: dto.telefono ?? null,
          passwordHash,
        },
        select: USUARIO_PUBLICO,
      });
      return { ...usuario, createdAt: usuario.createdAt.toISOString() };
    } catch (error) {
      // Carrera de dos registros simultáneos con el mismo correo.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(CORREO_DUPLICADO);
      }
      // El mensaje de Prisma puede incluir los argumentos de la consulta
      // (con el hash): no se propaga ni se registra el error original.
      throw new InternalServerErrorException('No se pudo crear la cuenta');
    }
  }
}
