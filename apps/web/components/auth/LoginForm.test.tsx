import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  LoginForm,
  MENSAJE_BLOQUEO,
  MENSAJE_CREDENCIALES,
  MENSAJE_SUSPENDIDA,
} from '@/components/auth/LoginForm';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/login',
}));

const PASSWORD = 'clave-segura-1';

function llenar(email = 'Ana@Test.dev', password = PASSWORD): void {
  fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

function respuesta(status: number, body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  push.mockClear();
  window.localStorage.clear();
});

describe('LoginForm (HU16)', () => {
  it('AC1: con credenciales válidas guarda el token (no la contraseña) y navega', async () => {
    global.fetch = respuesta(200, {
      token: 'jwt-1',
      usuario: { id: 'u-1', nombre: 'Ana' },
    });
    render(<LoginForm />);
    llenar();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/mis-reportes'));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'ana@test.dev',
      password: PASSWORD,
    });
    expect(window.localStorage.getItem('reunipet:token')).toBe('jwt-1');
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(PASSWORD);
  });

  it('AC1: vuelve a la pantalla de origen si es una ruta interna', async () => {
    global.fetch = respuesta(200, { token: 't', usuario: { nombre: 'Ana' } });
    render(<LoginForm siguiente="/alertas" />);
    llenar();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/alertas'));
  });

  it('no redirige fuera del sitio aunque "siguiente" lo pida', async () => {
    global.fetch = respuesta(200, { token: 't', usuario: { nombre: 'Ana' } });
    render(<LoginForm siguiente="//sitio-malicioso.com" />);
    llenar();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/mis-reportes'));
  });

  it('AC2: credenciales incorrectas muestran un único mensaje y no guardan sesión', async () => {
    global.fetch = respuesta(401, { message: MENSAJE_CREDENCIALES });
    render(<LoginForm />);
    llenar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      MENSAJE_CREDENCIALES,
    );
    expect(window.localStorage.getItem('reunipet:token')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it('AC3: con 429 informa el bloqueo y conserva la sesión que hubiera', async () => {
    window.localStorage.setItem('reunipet:token', 'sesion-previa');
    global.fetch = respuesta(429, { message: 'Too Many Requests' });
    render(<LoginForm />);
    llenar();

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_BLOQUEO);
    expect(window.localStorage.getItem('reunipet:token')).toBe('sesion-previa');
  });

  it('valida en cliente correo y contraseña sin llamar al backend', async () => {
    global.fetch = jest.fn();
    render(<LoginForm />);
    llenar('no-es-correo', '');

    expect(
      await screen.findByText('El correo no tiene un formato válido'),
    ).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('AC4: muestra "Tu sesión expiró" cuando llega por un 401', () => {
    render(<LoginForm motivo="expirada" />);
    expect(screen.getByTestId('aviso-sesion')).toHaveTextContent(
      'Tu sesión expiró',
    );
  });
});

describe('LoginForm (HU19)', () => {
  it('muestra "Tu cuenta está suspendida" cuando llega por CUENTA_SUSPENDIDA (distinto de "expiró")', () => {
    render(<LoginForm motivo="suspendida" />);
    const aviso = screen.getByTestId('aviso-sesion');
    expect(aviso).toHaveTextContent(MENSAJE_SUSPENDIDA);
    expect(aviso).not.toHaveTextContent('expiró');
  });

  it('login con la contraseña correcta de una cuenta suspendida (403) lo informa y no guarda sesión', async () => {
    global.fetch = respuesta(403, {
      code: 'CUENTA_SUSPENDIDA',
      message: 'Tu cuenta está suspendida',
    });
    render(<LoginForm />);
    llenar();
    expect(await screen.findByText(MENSAJE_SUSPENDIDA)).toBeInTheDocument();
    expect(window.localStorage.getItem('reunipet:token')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it('un motivo desconocido no muestra aviso', () => {
    render(<LoginForm motivo="toString" />);
    expect(screen.queryByTestId('aviso-sesion')).not.toBeInTheDocument();
  });
});
