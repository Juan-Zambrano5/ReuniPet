import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportarEncontradaPage from '@/app/reportar/encontrada/page';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

function stubRect(el: HTMLElement): void {
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

function ultimoBody(): Record<string, unknown> {
  const calls = (global.fetch as jest.Mock).mock.calls;
  const init = calls[calls.length - 1][1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

beforeEach(() => {
  push.mockClear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({ id: 'rep-nuevo', tipo: 'ENCONTRADA', estado: 'ENCONTRADA' }),
  }) as jest.Mock;
});

describe('Página reportar/encontrada (HU9 AC1/AC2)', () => {
  it('marca un punto en el mapa y lo envía junto al formulario', async () => {
    render(<ReportarEncontradaPage />);

    const mapa = screen.getByTestId('mapa-mock');
    stubRect(mapa);
    fireEvent.click(mapa, { clientX: 50, clientY: 25 });
    expect(screen.getByTestId('mapa-coordenadas')).toHaveTextContent(
      'Punto marcado',
    );

    fireEvent.click(screen.getByRole('radio', { name: /perro/i }));
    fireEvent.change(screen.getByLabelText(/^color/i), {
      target: { value: 'blanco' },
    });
    fireEvent.change(screen.getByLabelText(/características distintivas/i), {
      target: { value: 'collar azul' },
    });
    fireEvent.click(screen.getByRole('button', { name: /publicar reporte/i }));

    await screen.findByText('Publicando...');
    const body = ultimoBody();
    // y=25% → lat = 10.5 - 0.25*0.1 = 10.475; x=50% → lng = -66.95 + 0.05
    expect(body.latitud).toBeCloseTo(10.475, 5);
    expect(body.longitud).toBeCloseTo(-66.9, 5);
    expect(push).toHaveBeenCalledWith('/');
  });

  it('AC1: sin mapa puede publicar solo con la dirección escrita', async () => {
    render(<ReportarEncontradaPage />);

    fireEvent.click(screen.getByRole('radio', { name: /gato/i }));
    fireEvent.change(screen.getByLabelText(/^color/i), {
      target: { value: 'naranja' },
    });
    fireEvent.change(screen.getByLabelText(/características distintivas/i), {
      target: { value: 'oreja rota' },
    });
    fireEvent.change(screen.getByLabelText(/^ubicación/i), {
      target: { value: 'Calle 8 con Av. Sur' },
    });
    fireEvent.click(screen.getByRole('button', { name: /publicar reporte/i }));

    await screen.findByText('Publicando...');
    const body = ultimoBody();
    expect(body.ubicacion).toBe('Calle 8 con Av. Sur');
    expect(body.latitud).toBeUndefined();
    expect(push).toHaveBeenCalledWith('/');
  });
});
