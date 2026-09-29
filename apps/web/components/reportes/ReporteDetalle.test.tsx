import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EstadoReporte, ReporteResponse, TipoReporte } from '@reunipet/shared';
import { ReporteDetalle } from '@/components/reportes/ReporteDetalle';
import { getReporte } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  getReporte: jest.fn(),
  fotoUrl: (url: string) => url,
}));

const getReporteMock = getReporte as jest.Mock;

const reporte: ReporteResponse = {
  id: 'rep-1',
  tipo: TipoReporte.PERDIDA,
  especie: 'Perro',
  raza: 'Labrador',
  color: 'negro',
  caracteristicasDistintivas: 'collar rojo',
  ubicacion: 'Parque Central',
  estado: EstadoReporte.PERDIDA,
  propietarioId: 'user-1',
  createdAt: '2026-09-28T10:00:00.000Z',
  updatedAt: '2026-09-28T10:00:00.000Z',
  fotos: [
    {
      id: 'f-1',
      reporteId: 'rep-1',
      url: '/files/perro.jpg',
      orden: 0,
      createdAt: '2026-09-28T10:00:00.000Z',
    },
  ],
};

describe('ReporteDetalle (HU6 AC3)', () => {
  beforeEach(() => {
    getReporteMock.mockReset();
  });

  it('muestra los datos básicos del reporte', async () => {
    getReporteMock.mockResolvedValue(reporte);

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByText('Detalle del reporte')).toBeInTheDocument();
    expect(screen.getByText('Perro (Labrador)')).toBeInTheDocument();
    expect(screen.getByText('negro')).toBeInTheDocument();
    expect(screen.getByText('collar rojo')).toBeInTheDocument();
    expect(screen.getByText('Parque Central')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge')).toHaveTextContent('PERDIDO');
    expect(screen.getByRole('img')).toHaveAttribute('src', '/files/perro.jpg');
    expect(getReporteMock).toHaveBeenCalledWith('rep-1');
  });

  it('muestra un error si el reporte no se pudo cargar', async () => {
    getReporteMock.mockRejectedValue(new Error('network'));

    render(<ReporteDetalle id="no-existe" />);

    expect(
      await screen.findByText(/no se pudo cargar el reporte/i),
    ).toBeInTheDocument();
  });
});
