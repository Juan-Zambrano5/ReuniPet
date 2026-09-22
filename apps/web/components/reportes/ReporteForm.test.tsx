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
      screen.queryByLabelText(/ubicación/i),
    ).not.toBeInTheDocument();
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
});
