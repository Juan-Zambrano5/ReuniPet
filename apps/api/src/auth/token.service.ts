import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// HU16: el token vence a las 8 horas (decisión aprobada en SPRINT4_PLAN §3.1).
export const TOKEN_DURACION = '8h';
export const SESION_INVALIDA = 'Tu sesión expiró o no es válida';

const LARGO_MINIMO_SECRETO = 32;

interface CargaToken {
  sub: string;
}

/**
 * Lee JWT_SECRET del entorno. Sin un secreto suficientemente largo la API no
 * arranca: firmar tokens con un valor por defecto sería un hueco de seguridad.
 */
export function leerJwtSecret(): string {
  const secreto = process.env.JWT_SECRET ?? '';
  if (secreto.length < LARGO_MINIMO_SECRETO) {
    throw new Error(
      `JWT_SECRET debe estar definido y tener al menos ${LARGO_MINIMO_SECRETO} caracteres`,
    );
  }
  return secreto;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  firmar(usuarioId: string): Promise<string> {
    const carga: CargaToken = { sub: usuarioId };
    return this.jwt.signAsync(carga);
  }

  /** Devuelve el id del usuario del token o lanza 401 (vencido, alterado...). */
  async verificar(token: string): Promise<string> {
    try {
      const carga = await this.jwt.verifyAsync<CargaToken>(token);
      if (typeof carga.sub !== 'string' || carga.sub === '') {
        throw new Error('token sin sujeto');
      }
      return carga.sub;
    } catch {
      throw new UnauthorizedException(SESION_INVALIDA);
    }
  }
}
