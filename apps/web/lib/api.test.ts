import { getMisReportes, getSessionHeaders, iniciarSesion } from '@/lib/api';
import { navegacion, rutaSegura, urlLogin } from '@/lib/sesion';

function respuesta(status: number, body: unknown = {}): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('sesión con token (HU16)', () => {
  let ir: jest.SpyInstance;

  beforeEach(() => {
    window.localStorage.clear();
    ir = jest.spyOn(navegacion, 'ir').mockImplementation(() => undefined);
  });

  afterEach(() => ir.mockRestore());

  it('envía el token en Authorization: Bearer, nunca X-User-Id', () => {
    expect(getSessionHeaders()).toEqual({});
    window.localStorage.setItem('reunipet:token', 'jwt-1');
    window.localStorage.setItem('x-user-id', 'u-viejo');
    expect(getSessionHeaders()).toEqual({ Authorization: 'Bearer jwt-1' });
  });

  it('AC4: un 401 con token limpia la sesión y lleva a /login como "expirada"', async () => {
    window.localStorage.setItem('reunipet:token', 'jwt-vencido');
    window.localStorage.setItem('reunipet:nombre', 'Ana');
    global.fetch = respuesta(401, { message: 'Tu sesión expiró o no es válida' });

    await expect(getMisReportes()).rejects.toMatchObject({ status: 401 });

    expect(window.localStorage.getItem('reunipet:token')).toBeNull();
    expect(window.localStorage.getItem('reunipet:nombre')).toBeNull();
    expect(ir).toHaveBeenCalledWith(
      expect.stringMatching(/^\/login\?motivo=expirada&siguiente=%2F/),
    );
  });

  it('AC4: un 401 sin token lleva a /login como "requerida"', async () => {
    global.fetch = respuesta(401);
    await expect(getMisReportes()).rejects.toMatchObject({ status: 401 });
    expect(ir).toHaveBeenCalledWith(
      expect.stringMatching(/^\/login\?motivo=requerida/),
    );
  });

  it('otros errores (500) no tocan la sesión', async () => {
    window.localStorage.setItem('reunipet:token', 'jwt');
    global.fetch = respuesta(500);
    await expect(getMisReportes()).rejects.toMatchObject({ status: 500 });
    expect(window.localStorage.getItem('reunipet:token')).toBe('jwt');
    expect(ir).not.toHaveBeenCalled();
  });

  it('el 401 del propio login (credenciales) no redirige ni borra la sesión', async () => {
    window.localStorage.setItem('reunipet:token', 'jwt');
    global.fetch = respuesta(401, { message: 'Correo o contraseña incorrectos' });
    await expect(
      iniciarSesion({ email: 'a@b.co', password: 'x' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(ir).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('reunipet:token')).toBe('jwt');
  });

  it('rutaSegura solo acepta rutas internas', () => {
    expect(rutaSegura('/alertas')).toBe('/alertas');
    expect(rutaSegura('//evil.com')).toBeNull();
    expect(rutaSegura('https://evil.com')).toBeNull();
    expect(rutaSegura('/login?x=1')).toBeNull();
    expect(urlLogin('requerida', 'https://evil.com')).toBe(
      '/login?motivo=requerida',
    );
  });
});
