import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppNavbar } from '@/components/layout/AppNavbar';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
}));

beforeEach(() => {
  push.mockClear();
  window.localStorage.clear();
});

describe('AppNavbar (HU12 + HU16)', () => {
  it('sin sesión muestra "Iniciar sesión" junto a la campana y el avatar genérico', () => {
    render(<AppNavbar />);
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByLabelText('Avatar de usuario')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cerrar sesión' }),
    ).not.toBeInTheDocument();
  });

  it('con sesión muestra la inicial (sin cambiar tamaño ni forma) y oculta el enlace', async () => {
    window.localStorage.setItem('reunipet:token', 'jwt');
    window.localStorage.setItem('reunipet:nombre', 'ana Gómez');
    render(<AppNavbar />);
    const avatar = await screen.findByLabelText('Usuario: ana Gómez');
    expect(avatar).toHaveTextContent('A');
    expect(avatar).toHaveClass('h-9', 'w-9', 'rounded-full');
    expect(
      screen.queryByRole('link', { name: 'Iniciar sesión' }),
    ).not.toBeInTheDocument();
  });

  it('AC4: "Cerrar sesión" borra el token y vuelve al inicio', async () => {
    window.localStorage.setItem('reunipet:token', 'jwt');
    window.localStorage.setItem('reunipet:nombre', 'Ana');
    render(<AppNavbar />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(window.localStorage.getItem('reunipet:token')).toBeNull();
    expect(window.localStorage.getItem('reunipet:nombre')).toBeNull();
    expect(push).toHaveBeenCalledWith('/');
    expect(
      await screen.findByRole('link', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });

  it('borra la sesión simulada anterior (x-user-id, x-user-nombre) al cargar', () => {
    window.localStorage.setItem('x-user-id', 'u-viejo');
    window.localStorage.setItem('x-user-nombre', 'Viejo');
    render(<AppNavbar />);
    expect(window.localStorage.getItem('x-user-id')).toBeNull();
    expect(window.localStorage.getItem('x-user-nombre')).toBeNull();
    // Sin token, el nombre viejo no cuenta como sesión.
    expect(screen.getByLabelText('Avatar de usuario')).toBeInTheDocument();
  });
});

describe('AppNavbar (HU18)', () => {
  it('"Administración" solo aparece con rol ADMIN', async () => {
    window.localStorage.setItem('reunipet:token', 'jwt');
    window.localStorage.setItem('reunipet:nombre', 'Ana');
    window.localStorage.setItem('reunipet:rol', 'USUARIO');
    const { unmount } = render(<AppNavbar />);
    await screen.findByLabelText('Usuario: Ana');
    expect(
      screen.queryByRole('link', { name: 'Administración' }),
    ).not.toBeInTheDocument();
    unmount();

    window.localStorage.setItem('reunipet:rol', 'ADMIN');
    render(<AppNavbar />);
    expect(
      await screen.findByRole('link', { name: 'Administración' }),
    ).toHaveAttribute('href', '/admin');
  });

  it('cerrar sesión borra también el rol', async () => {
    window.localStorage.setItem('reunipet:token', 'jwt');
    window.localStorage.setItem('reunipet:nombre', 'Ana');
    window.localStorage.setItem('reunipet:rol', 'ADMIN');
    render(<AppNavbar />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(window.localStorage.getItem('reunipet:rol')).toBeNull();
    expect(
      screen.queryByRole('link', { name: 'Administración' }),
    ).not.toBeInTheDocument();
  });
});
