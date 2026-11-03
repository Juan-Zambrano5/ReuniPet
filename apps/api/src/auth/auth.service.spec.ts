import {
  ConflictException,
  HttpException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AuthService,
  CORREO_DUPLICADO,
  CREDENCIALES_INVALIDAS,
} from './auth.service';
import { LoginRateLimiter } from './login-rate-limiter';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password-hasher';

const PASSWORD = 'secreta123';

interface CreateArgs {
  data: {
    nombre: string;
    email: string;
    telefono: string | null;
    passwordHash: string;
  };
  select: Record<string, boolean>;
}

function dto(over: Partial<RegisterDto> = {}): RegisterDto {
  return plainToInstance(RegisterDto, {
    nombre: 'Ana',
    email: 'ana@test.dev',
    password: PASSWORD,
    ...over,
  });
}

describe('AuthService (HU12)', () => {
  let service: AuthService;
  let prismaMock: { usuario: { findFirst: jest.Mock; create: jest.Mock } };

  function createArgs(): CreateArgs {
    return prismaMock.usuario.create.mock.calls[0][0] as CreateArgs;
  }

  beforeEach(() => {
    prismaMock = {
      usuario: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: CreateArgs) =>
          Promise.resolve({
            id: 'u-1',
            nombre: data.nombre,
            email: data.email,
            telefono: data.telefono,
            createdAt: new Date('2026-11-02T00:00:00Z'),
          }),
        ),
      },
    };
    service = new AuthService(
      prismaMock as never,
      {} as never,
      new LoginRateLimiter(),
    );
  });

  it('AC1: crea la cuenta con el correo normalizado y devuelve datos públicos', async () => {
    const res = await service.register(dto({ email: '  Ana@Test.DEV ' }));

    expect(prismaMock.usuario.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'ana@test.dev', mode: 'insensitive' } },
      select: { id: true },
    });
    const { data, select } = createArgs();
    expect(data.email).toBe('ana@test.dev');
    expect(select).not.toHaveProperty('passwordHash');
    expect(res).toEqual({
      id: 'u-1',
      nombre: 'Ana',
      email: 'ana@test.dev',
      telefono: null,
      createdAt: '2026-11-02T00:00:00.000Z',
    });
  });

  it('guarda un hash scrypt, nunca la contraseña en claro', async () => {
    await service.register(dto());
    const { data } = createArgs();
    expect(data).not.toHaveProperty('password');
    expect(data.passwordHash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(data.passwordHash).not.toContain(PASSWORD);
    await expect(verifyPassword(PASSWORD, data.passwordHash)).resolves.toBe(
      true,
    );
  });

  it('AC2: correo existente → 409 y no crea', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({ id: 'otro' });
    await expect(service.register(dto())).rejects.toThrow(
      new ConflictException(CORREO_DUPLICADO),
    );
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });

  it('AC2: carrera de registros simultáneos (P2002) → 409', async () => {
    prismaMock.usuario.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.register(dto())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('un error inesperado no propaga el mensaje original (puede contener el hash)', async () => {
    prismaMock.usuario.create.mockRejectedValue(
      new Error('args: passwordHash=scrypt$abc'),
    );
    const err: unknown = await service.register(dto()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
    expect(
      JSON.stringify((err as InternalServerErrorException).getResponse()),
    ).not.toContain('scrypt');
  });
});

describe('AuthService.login (HU16)', () => {
  const EMAIL = 'ana@test.dev';
  let service: AuthService;
  let findFirst: jest.Mock;
  let firmar: jest.Mock;
  let reloj: number;
  let hash: string;

  beforeAll(async () => {
    hash = await hashPassword(PASSWORD);
  });

  beforeEach(() => {
    reloj = 1_000_000;
    findFirst = jest.fn().mockResolvedValue({
      id: 'u-1',
      nombre: 'Ana',
      email: EMAIL,
      telefono: null,
      passwordHash: hash,
      createdAt: new Date('2026-11-02T00:00:00Z'),
    });
    firmar = jest.fn().mockResolvedValue('token-firmado');
    service = new AuthService(
      { usuario: { findFirst } } as never,
      { firmar } as never,
      new LoginRateLimiter(() => reloj),
    );
  });

  const login = (
    email: string,
    password: string,
  ): ReturnType<AuthService['login']> => service.login({ email, password });

  it('AC1: credenciales válidas → token y datos públicos (sin hash)', async () => {
    const res = await login(' Ana@Test.DEV ', PASSWORD);
    expect(findFirst).toHaveBeenCalledWith({
      where: { email: { equals: EMAIL, mode: 'insensitive' } },
    });
    expect(firmar).toHaveBeenCalledWith('u-1');
    expect(res).toEqual({
      token: 'token-firmado',
      usuario: {
        id: 'u-1',
        nombre: 'Ana',
        email: EMAIL,
        telefono: null,
        createdAt: '2026-11-02T00:00:00.000Z',
      },
    });
    expect(JSON.stringify(res)).not.toContain('scrypt');
  });

  it('AC2: contraseña incorrecta y correo inexistente dan el MISMO 401', async () => {
    const malaClave: unknown = await login(EMAIL, 'otra-clave').catch(
      (e: unknown) => e,
    );
    findFirst.mockResolvedValue(null);
    const sinCorreo: unknown = await login('nadie@test.dev', PASSWORD).catch(
      (e: unknown) => e,
    );
    for (const err of [malaClave, sinCorreo]) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).message).toBe(
        CREDENCIALES_INVALIDAS,
      );
    }
    expect(firmar).not.toHaveBeenCalled();
  });

  it('AC2: un usuario sin contraseña (demo sin DEMO_PASSWORD) no puede entrar', async () => {
    findFirst.mockResolvedValue({ id: 'demo', passwordHash: null });
    await expect(login(EMAIL, PASSWORD)).rejects.toThrow(
      CREDENCIALES_INVALIDAS,
    );
  });

  it('AC3: tras 5 fallos responde 429 aunque la contraseña sea correcta, y no firma token', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(login(EMAIL, 'mala')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    const err: unknown = await login(EMAIL, PASSWORD).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(firmar).not.toHaveBeenCalled();
  });

  it('AC3: pasados 15 minutos vuelve a dejar entrar', async () => {
    for (let i = 0; i < 5; i++) {
      await login(EMAIL, 'mala').catch(() => undefined);
    }
    reloj += 15 * 60 * 1000 + 1;
    await expect(login(EMAIL, PASSWORD)).resolves.toHaveProperty('token');
  });

  it('AC3: un login correcto reinicia el conteo de fallos', async () => {
    for (let i = 0; i < 4; i++) {
      await login(EMAIL, 'mala').catch(() => undefined);
    }
    await login(EMAIL, PASSWORD);
    for (let i = 0; i < 4; i++) {
      await login(EMAIL, 'mala').catch(() => undefined);
    }
    await expect(login(EMAIL, PASSWORD)).resolves.toHaveProperty('token');
  });
});

describe('RegisterDto (HU12 AC3)', () => {
  async function propiedadesConError(
    body: Record<string, unknown>,
  ): Promise<string[]> {
    const errs = await validate(plainToInstance(RegisterDto, body));
    return errs.map((e) => e.property);
  }

  it('acepta datos válidos, recorta el nombre y trata el teléfono vacío como ausente', async () => {
    const d = plainToInstance(RegisterDto, {
      nombre: ' Ana ',
      email: 'a@b.co',
      telefono: '  ',
      password: PASSWORD,
    });
    expect(await validate(d)).toHaveLength(0);
    expect(d.nombre).toBe('Ana');
    expect(d.telefono).toBeUndefined();
  });

  it('rechaza nombre vacío, correo inválido y contraseña de menos de 8', async () => {
    expect(
      await propiedadesConError({
        nombre: '  ',
        email: 'no-es-correo',
        password: '1234567',
      }),
    ).toEqual(['nombre', 'email', 'password']);
  });

  it('los mensajes de error no incluyen el valor recibido', async () => {
    const errs = await validate(
      plainToInstance(RegisterDto, {
        nombre: 'Ana',
        email: 'a@b.co',
        password: 'corta',
      }),
    );
    expect(JSON.stringify(errs.map((e) => e.constraints))).not.toContain(
      'corta',
    );
  });
});

describe('password-hasher', () => {
  it('usa sal aleatoria y verifica en tiempo constante', async () => {
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    expect(a).not.toBe(b);
    await expect(verifyPassword(PASSWORD, a)).resolves.toBe(true);
    await expect(verifyPassword('otra-clave', a)).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, 'basura')).resolves.toBe(false);
  });
});
