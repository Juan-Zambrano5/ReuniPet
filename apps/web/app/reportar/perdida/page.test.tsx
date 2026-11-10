import '@testing-library/jest-dom';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ultimoMapa } from '@/__mocks__/leaflet';
import ReportarPerdidaPage from '@/app/reportar/perdida/page';
import { leerBorrador } from '@/lib/borrador';

const push = jest.fn();
const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
}));

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  window.sessionStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({ id: 'rep-perdida', tipo: 'PERDIDA', estado: 'PERDIDA' }),
  }) as jest.Mock;
});

describe('Página reportar/perdida (HU9 AC1/AC2)', () => {
  it('permite marcar la última ubicación vista y la guarda en el borrador', async () => {
    render(<ReportarPerdidaPage />);

    await screen.findByTestId('mapa-selector');
    act(() => ultimoMapa().clic(7.88, -72.51));

    fireEvent.click(screen.getByRole('radio', { name: /perro/i }));
    fireEvent.change(screen.getByLabelText(/^color/i), {
      target: { value: 'negro' },
    });
    fireEvent.change(screen.getByLabelText(/características distintivas/i), {
      target: { value: 'collar rojo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    // El paso 1 no publica: solo guarda el borrador y avanza.
    expect(push).toHaveBeenCalledWith('/reportar/perdida/fotos');
    expect(global.fetch).not.toHaveBeenCalled();

    const borrador = leerBorrador();
    expect(borrador?.latitud).toBe(7.88);
    expect(borrador?.longitud).toBe(-72.51);
  });

  it('el borrador queda sin coordenadas si no se marca el mapa', () => {
    render(<ReportarPerdidaPage />);

    fireEvent.click(screen.getByRole('radio', { name: /gato/i }));
    fireEvent.change(screen.getByLabelText(/^color/i), {
      target: { value: 'gris' },
    });
    fireEvent.change(screen.getByLabelText(/características distintivas/i), {
      target: { value: 'cola larga' },
    });
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    expect(global.fetch).not.toHaveBeenCalled();
    const borrador = leerBorrador();
    expect(borrador?.latitud).toBeUndefined();
    expect(borrador?.longitud).toBeUndefined();
  });

  it('al volver del paso 2 restaura el punto marcado en el mapa', async () => {
    window.sessionStorage.setItem(
      'reunipet:borrador-reporte',
      JSON.stringify({
        tipo: 'PERDIDA',
        especie: 'perro',
        raza: '',
        color: 'negro',
        caracteristicasDistintivas: 'collar rojo',
        ubicacion: '',
        latitud: 10.42,
        longitud: -66.9,
      }),
    );

    render(<ReportarPerdidaPage />);

    await waitFor(() => {
      expect(screen.getByTestId('mapa-coordenadas')).toHaveTextContent(
        'Punto marcado: 10.42, -66.9',
      );
    });
  });

  it('caso 2: con reporteId en el borrador el paso 1 redirige al paso 2', async () => {
    // El reporte ya se creó en un intento anterior (fallo de fotos, Atrás...).
    window.sessionStorage.setItem(
      'reunipet:borrador-reporte',
      JSON.stringify({
        tipo: 'PERDIDA',
        especie: 'perro',
        raza: '',
        color: 'negro',
        caracteristicasDistintivas: 'collar rojo',
        ubicacion: 'Parque Central',
        reporteId: 'rep-uno',
      }),
    );

    render(<ReportarPerdidaPage />);

    // replace (no push): vuelve a dejar el paso 1 sin crear nada nuevo.
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/reportar/perdida/fotos');
    });
    expect(push).not.toHaveBeenCalled();
    // Nunca un segundo reporte desde el paso 1.
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
