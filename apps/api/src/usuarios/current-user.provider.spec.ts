import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { SESION_INVALIDA } from '../auth/token.service';
import {
  JwtCurrentUserProvider,
  SESION_REQUERIDA,
} from './current-user.provider';

const ANA = { id: 'u-ana', nombre: 'Ana' };

function req(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe('JwtCurrentUserProvider (HU16)', () => {
  let provider: JwtCurrentUserProvider;
  let findUnique: jest.Mock;
  let verificar: jest.Mock;
  const entorno = { ...process.env };

  beforeEach(() => {
    findUnique = jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === ANA.id ? ANA : null),
    );
    verificar = jest.fn((t: string) =>
      t === 'valido'
        ? Promise.resolve(ANA.id)
        : Promise.reject(new UnauthorizedException(SESION_INVALIDA)),
    );
    provider = new JwtCurrentUserProvider(
      { usuario: { findUnique } } as never,
      { verificar } as never,
    );
    delete process.env.AUTH_MODE;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env = entorno;
  });

  it('con Bearer válido devuelve el usuario del token', async () => {
    await expect(
      provider.getUser(req({ authorization: 'Bearer valido' })),
    ).resolves.toBe(ANA);
  });

  it('sin sesión: getUser → 401 y getOptionalUser → null (ya no hay usuario demo implícito)', async () => {
    await expect(provider.getUser(req({}))).rejects.toThrow(SESION_REQUERIDA);
    await expect(provider.getOptionalUser(req({}))).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('token inválido → 401 incluso en rutas públicas', async () => {
    await expect(
      provider.getOptionalUser(req({ authorization: 'Bearer alterado' })),
    ).rejects.toThrow(SESION_INVALIDA);
    await expect(
      provider.getOptionalUser(req({ authorization: 'Basic abc' })),
    ).rejects.toThrow(SESION_INVALIDA);
  });

  it('token válido de un usuario que ya no existe → 401', async () => {
    verificar.mockResolvedValue('borrado');
    await expect(
      provider.getUser(req({ authorization: 'Bearer valido' })),
    ).rejects.toThrow(SESION_INVALIDA);
  });

  it('sin AUTH_MODE=dev, X-User-Id se ignora', async () => {
    await expect(provider.getUser(req({ 'x-user-id': ANA.id }))).rejects.toThrow(
      SESION_REQUERIDA,
    );
  });

  it('con AUTH_MODE=dev acepta X-User-Id', async () => {
    process.env.AUTH_MODE = 'dev';
    await expect(provider.getUser(req({ 'x-user-id': ANA.id }))).resolves.toBe(
      ANA,
    );
  });

  it('AUTH_MODE=dev no tiene efecto con NODE_ENV=production', async () => {
    process.env.AUTH_MODE = 'dev';
    process.env.NODE_ENV = 'production';
    await expect(provider.getUser(req({ 'x-user-id': ANA.id }))).rejects.toThrow(
      SESION_REQUERIDA,
    );
  });
});
