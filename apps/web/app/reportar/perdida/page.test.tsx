import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportarPerdidaPage from '@/app/reportar/perdida/page';

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
      Promise.resolve({ id: 'rep-perdida', tipo: 'PERDIDA', estado: 'PERDIDA' }),
  }) as jest.Mock;
});

describe('Página reportar/perdida (HU9 AC1/AC2)', () => {
  it('permite marcar la última ubicación vista y la envía con el reporte', async () => {
    render(<ReportarPerdidaPage />);

    const mapa = screen.getByTestId('mapa-mock');
    stubRect(mapa);
    fireEvent.click(mapa, { clientX: 100, clientY: 100 });

    fireEvent.click(screen.getByRole('radio', { name: /perro/i }));
    fireEvent.change(screen.getByLabelText(/^color/i), {
      target: { value: 'negro' },
    });
    fireEvent.change(screen.getByLabelText(/características distintivas/i), {
      target: { value: 'collar rojo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    await screen.findByText('Publicando...');
    const body = ultimoBody();
    expect(body.latitud).toBeCloseTo(10.4, 5);
    expect(body.longitud).toBeCloseTo(-66.85, 5);
    expect(push).toHaveBeenCalledWith('/reportar/perdida/fotos?id=rep-perdida');
  });

  it('el reporte se crea sin coordenadas si no se marca el mapa', async () => {
    render(<ReportarPerdidaPage />);

    fireEvent.click(screen.getByRole('radio', { name: /gato/i }));
    fireEvent.change(screen.getByLabelText(/^color/i), {
      target: { value: 'gris' },
    });
    fireEvent.change(screen.getByLabelText(/características distintivas/i), {
      target: { value: 'cola larga' },
    });
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    await screen.findByText('Publicando...');
    const body = ultimoBody();
    expect(body.latitud).toBeUndefined();
    expect(body.longitud).toBeUndefined();
  });
});
