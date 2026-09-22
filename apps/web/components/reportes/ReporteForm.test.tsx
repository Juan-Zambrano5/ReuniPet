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

describe('ReporteForm (HU1/HU3)', () => {
  it('HU1: renderiza el wireframe de mascota perdida (título, 4 campos, botón)', () => {
    render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
    expect(
      screen.getByRole('heading', { name: /reportar mascota perdida/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/especie/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^raza/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^color/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/características distintivas/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/ubicación/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /publicar reporte/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('ReuniPet')).toBeInTheDocument();
  });

  it('HU3: en tipo ENCONTRADA muestra el campo Ubicación y el título correcto', () => {
    render(<ReporteForm tipo={TipoReporte.ENCONTRADA} />);
    expect(
      screen.getByRole('heading', { name: /reportar mascota encontrada/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/ubicación/i)).toBeInTheDocument();
  });

  it('HU1 CA: muestra ErrorText bajo cada campo obligatorio vacío y aún así envía al backend', async () => {
    render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
    fireEvent.click(screen.getByRole('button', { name: /publicar reporte/i }));

    expect(await screen.findAllByTestId('error-text')).not.toHaveLength(0);
    expect(screen.getByText('La especie es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('El color es obligatorio')).toBeInTheDocument();
    // no bloquea el envío hasta confirmar con el backend
    expect(global.fetch).toHaveBeenCalled();
  });

  it('HU1: limpia el error del campo al escribir', async () => {
    render(<ReporteForm tipo={TipoReporte.PERDIDA} />);
    fireEvent.click(screen.getByRole('button', { name: /publicar reporte/i }));
    expect(
      await screen.findByText('La especie es obligatoria'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/especie/i), {
      target: { value: 'gato' },
    });
    expect(
      screen.queryByText('La especie es obligatoria'),
    ).not.toBeInTheDocument();
  });
});
