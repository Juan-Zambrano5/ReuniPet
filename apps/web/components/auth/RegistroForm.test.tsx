import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegistroForm } from '@/components/auth/RegistroForm';
import { AppNavbar } from '@/components/layout/AppNavbar';

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
    expect(window.localStorage.getItem('x-user-id')).toBeNull();
  });

  it('AC2: si el correo ya existe (409) muestra el error bajo el correo y no guarda sesión', async () => {
    global.fetch = respuesta(409, { message: 'El correo ya está registrado' });
    render(<RegistroForm />);
    llenar();
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    const error = await screen.findByText('El correo ya está registrado');
    expect(error).toHaveAttribute('id', 'email-error');
    expect(window.localStorage.getItem('x-user-id')).toBeNull();
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

  it('AC1: al registrarse envía el correo normalizado, guarda la sesión simulada y navega', async () => {
    global.fetch = respuesta(201, {
      id: 'u-nuevo',
      nombre: 'Ana Gómez',
      email: 'ana@test.dev',
      telefono: null,
      createdAt: '2026-11-02T00:00:00.000Z',
    });
    render(<RegistroForm />);
    llenar();
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/auth\/register$/);
    expect(JSON.parse(init.body as string)).toEqual({
      nombre: 'Ana Gómez',
      email: 'ana@test.dev',
      password: PASSWORD,
    });
    expect(window.localStorage.getItem('x-user-id')).toBe('u-nuevo');
    expect(window.localStorage.getItem('x-user-nombre')).toBe('Ana Gómez');
    // Nunca se guarda la contraseña en el navegador.
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(PASSWORD);
  });
});

describe('AppNavbar (HU12)', () => {
  it('sin sesión muestra "Crear cuenta" junto a la campana y el avatar genérico', () => {
    render(<AppNavbar />);
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/registro',
    );
    expect(screen.getByLabelText('Avatar de usuario')).toBeInTheDocument();
  });

  it('con sesión oculta el enlace y muestra la inicial en el avatar', async () => {
    window.localStorage.setItem('x-user-id', 'u-1');
    window.localStorage.setItem('x-user-nombre', 'ana Gómez');
    render(<AppNavbar />);
    const avatar = await screen.findByLabelText('Usuario: ana Gómez');
    expect(avatar).toHaveTextContent('A');
    expect(avatar).toHaveClass('h-9', 'w-9', 'rounded-full');
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).not.toBeInTheDocument();
  });
});
