import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegistroForm } from '@/components/auth/RegistroForm';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/registro',
}));

const PASSWORD = 'clave-segura-1';

function llenar(datos: Partial<Record<string, string>> = {}): void {
  const v = {
    nombre: 'Ana Gómez',
    email: 'Ana@Test.dev',
    password: PASSWORD,
    confirmar: PASSWORD,
    ...datos,
  };
  fireEvent.change(screen.getByLabelText(/nombre completo/i), {
    target: { value: v.nombre },
  });
  fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
    target: { value: v.email },
  });
  fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
    target: { value: v.password },
  });
  fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
    target: { value: v.confirmar },
  });
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

describe('RegistroForm (HU12)', () => {
  it('AC3: muestra los errores junto a cada campo y no llama al backend', async () => {
    global.fetch = jest.fn() as jest.Mock;
    render(<RegistroForm />);
    llenar({ nombre: ' ', email: 'no-es-correo', password: '1234567', confirmar: 'otra' });
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El correo no tiene un formato válido')).toBeInTheDocument();
    expect(
      screen.getByText('La contraseña debe tener al menos 8 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute(
      'aria-describedby',
      'email-error',
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('reunipet:token')).toBeNull();
  });

  it('AC2: si el correo ya existe (409) muestra el error bajo el correo y no guarda sesión', async () => {
    global.fetch = respuesta(409, { message: 'El correo ya está registrado' });
    render(<RegistroForm />);
    llenar();
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    const error = await screen.findByText('El correo ya está registrado');
    expect(error).toHaveAttribute('id', 'email-error');
    expect(window.localStorage.getItem('reunipet:token')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it('AC3: ubica los errores 400 del servidor en su campo', async () => {
    global.fetch = respuesta(400, {
      message: ['La contraseña debe tener al menos 8 caracteres'],
    });
    render(<RegistroForm />);
    llenar();
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(
      await screen.findByText('La contraseña debe tener al menos 8 caracteres'),
    ).toHaveAttribute('id', 'password-error');
  });

  it('AC1 (HU16): al registrarse inicia sesión con la cuenta nueva, guarda solo el token y navega', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'u-nuevo',
            nombre: 'Ana Gómez',
            email: 'ana@test.dev',
            telefono: null,
            createdAt: '2026-11-02T00:00:00.000Z',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            token: 'jwt-de-prueba',
            usuario: { id: 'u-nuevo', nombre: 'Ana Gómez' },
          }),
      });
    render(<RegistroForm />);
    llenar();
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/mis-reportes'));
    const llamadas = (global.fetch as jest.Mock).mock.calls as [
      string,
      RequestInit,
    ][];
    expect(llamadas[0][0]).toMatch(/\/auth\/register$/);
    expect(JSON.parse(llamadas[0][1].body as string)).toEqual({
      nombre: 'Ana Gómez',
      email: 'ana@test.dev',
      password: PASSWORD,
    });
    expect(llamadas[1][0]).toMatch(/\/auth\/login$/);
    expect(JSON.parse(llamadas[1][1].body as string)).toEqual({
      email: 'ana@test.dev',
      password: PASSWORD,
    });
    expect(window.localStorage.getItem('reunipet:token')).toBe('jwt-de-prueba');
    expect(window.localStorage.getItem('reunipet:nombre')).toBe('Ana Gómez');
    // Ya no se guarda el id como credencial, y nunca la contraseña.
    expect(window.localStorage.getItem('x-user-id')).toBeNull();
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(PASSWORD);
  });

  it('HU16: si la cuenta se crea pero el login falla, lleva a /login sin sesión', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'u-nuevo', nombre: 'Ana Gómez' }),
      })
      .mockRejectedValueOnce(new Error('sin red'));
    render(<RegistroForm />);
    llenar();
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(window.localStorage.getItem('reunipet:token')).toBeNull();
  });
});
