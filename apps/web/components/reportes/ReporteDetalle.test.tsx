import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { EstadoReporte, ReporteResponse, TipoReporte } from '@reunipet/shared';
import { ReporteDetalle } from '@/components/reportes/ReporteDetalle';
import { ApiError, getReporte } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  getReporte: jest.fn(),
  fotoUrl: (url: string) => url,
  ApiError: jest.requireActual('@/lib/api').ApiError,
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
  latitud: 10.12,
  longitud: -66.99,
  esPropietario: false,
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

  it('HU9 AC3: a un tercero muestra las coordenadas como zona aproximada', async () => {
    getReporteMock.mockResolvedValue(reporte);

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('reporte-coordenadas')).toHaveTextContent(
      '10.12, -66.99',
    );
    expect(screen.getByTestId('reporte-precision')).toHaveTextContent(
      'Zona aproximada (~1 km)',
    );
  });

  it('HU9 AC3: al propietario le muestra el punto exacto', async () => {
    getReporteMock.mockResolvedValue({
      ...reporte,
      latitud: 10.12345,
      longitud: -66.98765,
      esPropietario: true,
    });

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('reporte-coordenadas')).toHaveTextContent(
      '10.12345, -66.98765',
    );
    expect(screen.getByTestId('reporte-precision')).toHaveTextContent(
      'Punto exacto',
    );
  });

  it('HU9: sin coordenadas no se muestra la fila de coordenadas', async () => {
    getReporteMock.mockResolvedValue({
      ...reporte,
      latitud: null,
      longitud: null,
    });

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByText('Detalle del reporte')).toBeInTheDocument();
    expect(
      screen.queryByTestId('reporte-coordenadas'),
    ).not.toBeInTheDocument();
  });
});

describe('ReporteDetalle (HU13)', () => {
  const foto = (n: number) => ({
    id: `f-${n}`,
    reporteId: 'rep-1',
    url: `/files/foto-${n}.jpg`,
    orden: n,
    createdAt: '2026-09-28T10:00:00.000Z',
  });

  beforeEach(() => {
    getReporteMock.mockReset();
  });

  it('AC1: muestra la foto principal con sus miniaturas y cambia al pulsar una miniatura', async () => {
    getReporteMock.mockResolvedValue({
      ...reporte,
      fotos: [foto(0), foto(1), foto(2)],
    });

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('galeria-principal')).toBeInTheDocument();
    expect(screen.getByTestId('galeria-miniaturas')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', '/files/foto-0.jpg');
    expect(screen.getByTestId('miniatura-0')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByTestId('miniatura-1'));

    expect(screen.getByRole('img')).toHaveAttribute('src', '/files/foto-1.jpg');
    expect(screen.getByTestId('miniatura-1')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('miniatura-0')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('AC1: con una sola foto no se muestran miniaturas', async () => {
    getReporteMock.mockResolvedValue(reporte);

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByRole('img')).toHaveAttribute(
      'src',
      '/files/perro.jpg',
    );
    expect(screen.queryByTestId('galeria-miniaturas')).not.toBeInTheDocument();
  });

  it('AC1: en un reporte de pérdida muestra "Mascota perdida"', async () => {
    getReporteMock.mockResolvedValue(reporte);

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('reporte-tipo')).toHaveTextContent(
      'Mascota perdida',
    );
  });

  it('AC1: en un reporte de hallazgo muestra "Mascota encontrada"', async () => {
    getReporteMock.mockResolvedValue({
      ...reporte,
      tipo: TipoReporte.ENCONTRADA,
      estado: EstadoReporte.ENCONTRADA,
    });

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('reporte-tipo')).toHaveTextContent(
      'Mascota encontrada',
    );
  });

  it('AC2: sin fotografías muestra el mensaje de reemplazo y ninguna imagen', async () => {
    getReporteMock.mockResolvedValue({ ...reporte, fotos: [] });

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('foto-placeholder')).toHaveTextContent(
      /no tiene fotografías/i,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByTestId('galeria-miniaturas')).not.toBeInTheDocument();
  });

  it('AC3: un 404 muestra "Reporte no encontrado" con enlace para volver al listado', async () => {
    getReporteMock.mockRejectedValue(new ApiError(404, {}));

    render(<ReporteDetalle id="no-existe" />);

    expect(await screen.findByTestId('no-encontrado')).toHaveTextContent(
      'Reporte no encontrado',
    );
    expect(
      screen.getByRole('link', { name: /volver al listado/i }),
    ).toHaveAttribute('href', '/');
  });
});
