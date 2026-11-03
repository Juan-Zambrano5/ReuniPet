import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReporteForm } from '@/components/reportes/ReporteForm';
import { TipoReporte } from '@reunipet/shared';
import { leerBorrador } from '@/lib/borrador';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
  window.sessionStorage.clear();
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

  it('HU3: en tipo ENCONTRADA muestra Ubicación y el botón Siguiente paso', () => {
    render(<ReporteForm tipo={TipoReporte.ENCONTRADA} />);
    expect(screen.getByLabelText(/ubicación/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /siguiente paso/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /publicar reporte/i }),
    ).not.toBeInTheDocument();
  });

  it('HU1 CA: muestra ErrorText bajo campos vacíos y NO navega ni llama al backend', async () => {
    render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    expect(await screen.findAllByTestId('error-text')).not.toHaveLength(0);
    expect(screen.getByText('La especie es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('El color es obligatorio')).toBeInTheDocument();
    // El paso 1 solo valida y guarda borrador: nunca publica ni navega.
    expect(global.fetch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(leerBorrador()).toBeNull();
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

  it('HU1: Siguiente paso guarda el borrador y navega al paso 2 sin llamar a la API', async () => {
    render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
    fireEvent.click(screen.getByRole('radio', { name: /perro/i }));
    fireEvent.change(screen.getByLabelText(/^color/i), {
      target: { value: 'negro' },
    });
    fireEvent.change(screen.getByLabelText(/características distintivas/i), {
      target: { value: 'collar rojo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

    expect(push).toHaveBeenCalledWith('/reportar/perdida/fotos');
    expect(global.fetch).not.toHaveBeenCalled();

    const borrador = leerBorrador();
    expect(borrador).not.toBeNull();
    expect(borrador?.especie).toBe('perro');
    expect(borrador?.color).toBe('negro');
    expect(borrador?.caracteristicasDistintivas).toBe('collar rojo');
    expect(borrador?.reporteId).toBeUndefined();
  });

  it('HU1: al volver del paso 2 los campos vienen rellenados desde el borrador', () => {
    window.sessionStorage.setItem(
      'reunipet:borrador-reporte',
      JSON.stringify({
        tipo: 'PERDIDA',
        especie: 'gato',
        raza: 'siames',
        color: 'crema',
        caracteristicasDistintivas: 'orejas negras',
        ubicacion: 'Parque Central',
      }),
    );

    render(<ReporteForm tipo={TipoReporte.PERDIDA} />);

    expect(screen.getByRole('radio', { name: /gato/i })).toBeChecked();
    expect(screen.getByLabelText(/^raza/i)).toHaveValue('siames');
    expect(screen.getByLabelText(/^color/i)).toHaveValue('crema');
    expect(
      screen.getByLabelText(/características distintivas/i),
    ).toHaveValue('orejas negras');
    expect(screen.getByLabelText(/^ubicación/i)).toHaveValue('Parque Central');
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

  describe('HU9 — punto en el mapa', () => {
    it('AC2: con punto marcado guarda latitud y longitud en el borrador', () => {
      render(
        <ReporteForm
          tipo={TipoReporte.PERDIDA}
          punto={{ lat: 10.12, lng: -66.99 }}
        />,
      );
      completarCamposBasicos();
      fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

      const borrador = leerBorrador();
      expect(borrador?.latitud).toBe(10.12);
      expect(borrador?.longitud).toBe(-66.99);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('AC2: sin punto marcado el borrador no guarda coordenadas', () => {
      render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
      completarCamposBasicos();
      fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

      const borrador = leerBorrador();
      expect(borrador?.latitud).toBeUndefined();
      expect(borrador?.longitud).toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('AC1: en ENCONTRADA el punto en el mapa sustituye a la dirección escrita', () => {
      render(
        <ReporteForm
          tipo={TipoReporte.ENCONTRADA}
          punto={{ lat: 10.4, lng: -66.85 }}
        />,
      );
      completarCamposBasicos();
      // Sin escribir la dirección: el punto debe bastar.
      fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

      expect(
        screen.queryByText(/indica la ubicación/i),
      ).not.toBeInTheDocument();
      // Paso 1: guarda borrador con coordenadas y avanza; nunca publica.
      expect(global.fetch).not.toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith('/reportar/encontrada/fotos');
      const borrador = leerBorrador();
      expect(borrador?.tipo).toBe('ENCONTRADA');
      expect(borrador?.latitud).toBe(10.4);
      expect(borrador?.longitud).toBe(-66.85);
    });

    it('AC1: en ENCONTRADA sin punto y sin dirección aparece el error', async () => {
      render(<ReporteForm tipo={TipoReporte.ENCONTRADA} />);
      completarCamposBasicos();
      fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

      expect(
        await screen.findByText(/indica la ubicación/i),
      ).toBeInTheDocument();
      // Con error no se avanza ni se guarda nada.
      expect(push).not.toHaveBeenCalled();
      expect(leerBorrador()).toBeNull();
    });

    it('AC1: la dirección escrita sigue siendo válida sin punto en el mapa', () => {
      render(<ReporteForm tipo={TipoReporte.ENCONTRADA} />);
      completarCamposBasicos();
      fireEvent.change(screen.getByLabelText(/^ubicación/i), {
        target: { value: 'Av. Principal con Calle 5' },
      });
      fireEvent.click(screen.getByRole('button', { name: /siguiente paso/i }));

      expect(push).toHaveBeenCalledWith('/reportar/encontrada/fotos');
      expect(global.fetch).not.toHaveBeenCalled();
      const borrador = leerBorrador();
      expect(borrador?.ubicacion).toBe('Av. Principal con Calle 5');
      expect(borrador?.latitud).toBeUndefined();
      expect(borrador?.longitud).toBeUndefined();
    });
  });
});
