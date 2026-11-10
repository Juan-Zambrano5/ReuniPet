import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Usuario } from '@prisma/client';
import {
  LoginResponse,
  RolUsuario,
  UsuarioPublicoResponse,
} from '@reunipet/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginRateLimiter } from './login-rate-limiter';
import { hashPassword, verifyPassword } from './password-hasher';
import { TokenService } from './token.service';

export const CORREO_DUPLICADO = 'El correo ya está registrado';
// HU16 AC2: un único mensaje, sin revelar si falló el correo o la contraseña.
export const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos';
export const DEMASIADOS_INTENTOS =
  'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.';

// Campos públicos: la respuesta NUNCA incluye passwordHash.
const USUARIO_PUBLICO = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  rol: true,
  createdAt: true,
} as const;

// Hash de relleno: si el correo no existe se verifica contra él igual, para
// que el tiempo de respuesta no revele qué correos están registrados.
let hashDeRelleno: Promise<string> | null = null;
function obtenerHashDeRelleno(): Promise<string> {
  hashDeRelleno ??= hashPassword('relleno-para-tiempo-constante');
  return hashDeRelleno;
}

export function aUsuarioPublico(
  u: Pick<Usuario, 'id' | 'nombre' | 'email' | 'telefono' | 'rol' | 'createdAt'>,
): UsuarioPublicoResponse {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    telefono: u.telefono,
    rol: u.rol as RolUsuario,
    createdAt: u.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly limitador: LoginRateLimiter,
  ) {}

  /**
   * HU16: verifica correo y contraseña y devuelve un JWT de 8 horas.
   * Nunca registra el body ni distingue en la respuesta qué dato falló.
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const email = dto.email.trim().toLowerCase();

    // AC3: con el correo bloqueado no se verifica nada ni cambia la sesión.
    if (this.limitador.estaBloqueado(email)) {
      throw new HttpException(DEMASIADOS_INTENTOS, HttpStatus.TOO_MANY_REQUESTS);
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    const hash = usuario?.passwordHash ?? (await obtenerHashDeRelleno());
    const valida = await verifyPassword(dto.password, hash);

    if (!usuario || !usuario.passwordHash || !valida) {
      this.limitador.registrarFallo(email);
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    this.limitador.registrarExito(email);
    return {
      token: await this.tokens.firmar(usuario.id),
      usuario: aUsuarioPublico(usuario),
    };
  }

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
      return aUsuarioPublico(usuario);
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
