import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { RequiereSesion } from '@/components/auth/RequiereSesion';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/mis-reportes',
}));

beforeEach(() => {
  replace.mockClear();
  window.localStorage.clear();
});

describe('RequiereSesion (HU16 AC4)', () => {
  it('sin sesión no muestra la pantalla y lleva a /login con la ruta de vuelta', async () => {
    render(
      <RequiereSesion>
        <p>contenido privado</p>
      </RequiereSesion>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/login?motivo=requerida&siguiente=%2Fmis-reportes',
      ),
    );
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument();
  });

  it('con sesión muestra la pantalla', async () => {
    window.localStorage.setItem('reunipet:token', 'jwt');
    render(
      <RequiereSesion>
        <p>contenido privado</p>
      </RequiereSesion>,
    );
    expect(await screen.findByText('contenido privado')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
