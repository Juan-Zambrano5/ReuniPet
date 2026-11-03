import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportarEncontradaPage from '@/app/reportar/encontrada/page';
import { leerBorrador } from '@/lib/borrador';

const push = jest.fn();
const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
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

function completarCampos(): void {
  fireEvent.click(screen.getByRole('radio', { name: /perro/i }));
  fireEvent.change(screen.getByLabelText(/^color/i), {
    target: { value: 'blanco' },
  });
  fireEvent.change(screen.getByLabelText(/características distintivas/i), {
    target: { value: 'collar azul' },
  });
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  window.sessionStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({ id: 'rep-nuevo', tipo: 'ENCONTRADA', estado: 'ENCONTRADA' }),
  }) as jest.Mock;
});

describe('Página reportar/encontrada (HU3 — 2 pasos)', () => {
  it('AC2: marca un punto en el mapa, guarda el borrador y avanza al paso 2 sin publicar', async () => {
    render(<ReportarEncontradaPage />);

    const mapa = screen.getByTestId('mapa-mock');
    stubRect(mapa);
    fireEvent.click(mapa, { clientX: 50, clientY: 25 });
    expect(screen.getByTestId('mapa-coordenadas')).toHaveTextContent(
      'Punto marcado',
    );

    completarCampos();
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    // Paso 1 de 2: no publica; guarda y avanza al paso 2 (fotos).
    expect(push).toHaveBeenCalledWith('/reportar/encontrada/fotos');
    expect(global.fetch).not.toHaveBeenCalled();

    const borrador = leerBorrador();
    expect(borrador?.tipo).toBe('ENCONTRADA');
    // y=25% → lat = 10.5 - 0.25*0.1 = 10.475; x=50% → lng = -66.95 + 0.05
    expect(borrador?.latitud).toBeCloseTo(10.475, 5);
    expect(borrador?.longitud).toBeCloseTo(-66.9, 5);
  });

  it('AC1: sin mapa puede avanzar solo con la dirección escrita', () => {
    render(<ReportarEncontradaPage />);

    completarCampos();
    fireEvent.change(screen.getByLabelText(/^ubicación/i), {
      target: { value: 'Calle 8 con Av. Sur' },
    });
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    expect(push).toHaveBeenCalledWith('/reportar/encontrada/fotos');
    expect(global.fetch).not.toHaveBeenCalled();
    const borrador = leerBorrador();
    expect(borrador?.ubicacion).toBe('Calle 8 con Av. Sur');
    expect(borrador?.latitud).toBeUndefined();
    expect(borrador?.longitud).toBeUndefined();
  });

  it('AC3: sin ubicación (ni dirección ni punto) no avanza ni guarda', async () => {
    render(<ReportarEncontradaPage />);

    completarCampos();
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    expect(
      await screen.findByText(/indica la ubicación/i),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(leerBorrador()).toBeNull();
  });

  it('restaura el punto del mapa al volver del paso 2', async () => {
    window.sessionStorage.setItem(
      'reunipet:borrador-reporte',
      JSON.stringify({
        tipo: 'ENCONTRADA',
        especie: 'perro',
        raza: '',
        color: 'blanco',
        caracteristicasDistintivas: 'collar azul',
        ubicacion: '',
        latitud: 10.42,
        longitud: -66.9,
      }),
    );

    render(<ReportarEncontradaPage />);

    await waitFor(() => {
      expect(screen.getByTestId('mapa-coordenadas')).toHaveTextContent(
        'Punto marcado: 10.42, -66.9',
      );
    });
  });

  it('caso 2: con reporteId en el borrador el paso 1 redirige al paso 2', async () => {
    window.sessionStorage.setItem(
      'reunipet:borrador-reporte',
      JSON.stringify({
        tipo: 'ENCONTRADA',
        especie: 'perro',
        raza: '',
        color: 'blanco',
        caracteristicasDistintivas: 'collar azul',
        ubicacion: 'Calle 8',
        reporteId: 'rep-hallazgo',
      }),
    );

    render(<ReportarEncontradaPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/reportar/encontrada/fotos');
    });
    expect(push).not.toHaveBeenCalled();
    // Nunca un segundo reporte desde el paso 1.
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
