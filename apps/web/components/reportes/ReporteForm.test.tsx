import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReporteForm } from '@/components/reportes/ReporteForm';
import { TipoReporte } from '@reunipet/shared';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({ id: 'rep-test', tipo: 'PERDIDA', estado: 'PERDIDA' }),
  }) as jest.Mock;
});

describe('ReporteForm (HU1/HU3 — rediseño Figma)', () => {
  it('HU1: renderiza el formulario de mascota perdida (chips especie, campos, botón Siguiente paso)', () => {
    render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
    expect(
      screen.getByRole('radio', { name: /perro/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /gato/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^raza/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^color/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/características distintivas/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/ubicación \(opcional\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /siguiente paso/i }),
    ).toBeInTheDocument();
  });

  it('HU3: en tipo ENCONTRADA muestra Ubicación y el botón Publicar reporte', () => {
    render(<ReporteForm tipo={TipoReporte.ENCONTRADA} />);
    expect(screen.getByLabelText(/ubicación/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /publicar reporte/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /siguiente paso/i }),
    ).not.toBeInTheDocument();
  });

  it('HU1 CA: muestra ErrorText bajo campos vacíos y aún así envía al backend', async () => {
    render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    expect(await screen.findAllByTestId('error-text')).not.toHaveLength(0);
    expect(screen.getByText('La especie es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('El color es obligatorio')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalled();
  });

  it('HU1: seleccionar una especie limpia el error de especie', async () => {
    render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));
    expect(
      await screen.findByText('La especie es obligatoria'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /gato/i }));
    expect(
      screen.queryByText('La especie es obligatoria'),
    ).not.toBeInTheDocument();
  });

  it('HU1: tras crear el reporte navega al paso 2 (fotos) conservando el id', async () => {
    render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
    fireEvent.click(screen.getByRole('radio', { name: /perro/i }));
    fireEvent.change(screen.getByLabelText(/^color/i), {
      target: { value: 'negro' },
    });
    fireEvent.change(screen.getByLabelText(/características distintivas/i), {
      target: { value: 'collar rojo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    await screen.findByText('Publicando...');
    expect(push).toHaveBeenCalledWith('/reportar/perdida/fotos?id=rep-test');
  });

  function completarCamposBasicos(): void {
    fireEvent.click(screen.getByRole('radio', { name: /perro/i }));
    fireEvent.change(screen.getByLabelText(/^color/i), {
      target: { value: 'negro' },
    });
    fireEvent.change(screen.getByLabelText(/características distintivas/i), {
      target: { value: 'collar rojo' },
    });
  }

  function ultimoBodyEnviado(): Record<string, unknown> {
    const calls = (global.fetch as jest.Mock).mock.calls;
    const init = calls[calls.length - 1][1] as RequestInit;
    return JSON.parse(String(init.body)) as Record<string, unknown>;
  }

  describe('HU9 — punto en el mapa', () => {
    it('AC2: con punto marcado envía latitud y longitud al crear', async () => {
      render(
        <ReporteForm
          tipo={TipoReporte.PERDIDA}
          punto={{ lat: 10.12, lng: -66.99 }}
        />,
      );
      completarCamposBasicos();
      fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

      await screen.findByText('Publicando...');
      const body = ultimoBodyEnviado();
      expect(body.latitud).toBe(10.12);
      expect(body.longitud).toBe(-66.99);
    });

    it('AC2: sin punto marcado no envía coordenadas', async () => {
      render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
      completarCamposBasicos();
      fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

      await screen.findByText('Publicando...');
      const body = ultimoBodyEnviado();
      expect(body.latitud).toBeUndefined();
      expect(body.longitud).toBeUndefined();
    });

    it('AC1: en ENCONTRADA el punto en el mapa sustituye a la dirección escrita', async () => {
      render(
        <ReporteForm
          tipo={TipoReporte.ENCONTRADA}
          punto={{ lat: 10.4, lng: -66.85 }}
        />,
      );
      completarCamposBasicos();
      // Sin escribir la dirección: el punto debe bastar.
      fireEvent.click(screen.getByRole('button', { name: /publicar reporte/i }));

      expect(
        screen.queryByText(/indica la ubicación/i),
      ).not.toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalled();
    });

    it('AC1: en ENCONTRADA sin punto y sin dirección aparece el error', async () => {
      render(<ReporteForm tipo={TipoReporte.ENCONTRADA} />);
      completarCamposBasicos();
      fireEvent.click(screen.getByRole('button', { name: /publicar reporte/i }));

      expect(
        await screen.findByText(/indica la ubicación/i),
      ).toBeInTheDocument();
    });

    it('AC1: la dirección escrita sigue siendo válida sin punto en el mapa', async () => {
      render(<ReporteForm tipo={TipoReporte.ENCONTRADA} />);
      completarCamposBasicos();
      fireEvent.change(screen.getByLabelText(/^ubicación/i), {
        target: { value: 'Av. Principal con Calle 5' },
      });
      fireEvent.click(screen.getByRole('button', { name: /publicar reporte/i }));

      await screen.findByText('Publicando...');
      const body = ultimoBodyEnviado();
      expect(body.ubicacion).toBe('Av. Principal con Calle 5');
      expect(body.latitud).toBeUndefined();
    });
  });
});
