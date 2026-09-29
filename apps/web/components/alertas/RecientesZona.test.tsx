import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ListReportesResponse, TipoReporte } from '@reunipet/shared';
import { RecientesZona } from '@/components/alertas/RecientesZona';
import { getReportes } from '@/lib/api';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('@/lib/api', () => ({
  getReportes: jest.fn(),
  fotoUrl: (url: string) => url,
}));

const getReportesMock = getReportes as jest.Mock;

const reportes: ListReportesResponse = {
  items: [
    {
      id: 'rep-1',
      tipo: TipoReporte.PERDIDA,
      especie: 'Perro',
      raza: 'Labrador',
      color: 'negro',
      caracteristicasDistintivas: 'collar rojo',
      estado: 'PERDIDA',
      ubicacion: 'Parque Central',
      latitud: null,
      longitud: null,
      esPropietario: false,
      fotoPrincipal: {
        id: 'f-1',
        reporteId: 'rep-1',
        url: '/files/perro.jpg',
        orden: 0,
        createdAt: '2026-09-28T10:00:00.000Z',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'rep-2',
      tipo: TipoReporte.PERDIDA,
      especie: 'Gato',
      raza: null,
      color: 'blanco',
      caracteristicasDistintivas: 'oreja cortada',
      estado: 'PERDIDA',
      ubicacion: 'Av. Central',
      latitud: null,
      longitud: null,
      esPropietario: false,
      fotoPrincipal: null,
      createdAt: '2026-09-27T10:00:00.000Z',
      updatedAt: '2026-09-27T10:00:00.000Z',
    },
  ],
  meta: { page: 1, limit: 6, total: 2, totalPages: 1 },
};

describe('RecientesZona (HU6)', () => {
  beforeEach(() => {
    getReportesMock.mockReset();
  });

  it('AC1: muestra foto, especie, raza, color, ubicación y tiempo de cada reporte', async () => {
    getReportesMock.mockResolvedValue(reportes);

    render(<RecientesZona tipo={TipoReporte.PERDIDA} />);

    const primero = await screen.findByTestId('reciente-rep-1');
    expect(primero).toHaveTextContent('Perro (Labrador)');
    expect(primero).toHaveTextContent('negro');
    expect(primero).toHaveTextContent('Parque Central');
    expect(primero.querySelector('img')).toHaveAttribute(
      'src',
      '/files/perro.jpg',
    );

    const segundo = screen.getByTestId('reciente-rep-2');
    expect(segundo).toHaveTextContent('Gato');
    expect(segundo).toHaveTextContent('Av. Central');
    // el tiempo transcurrido se deriva de createdAt
    expect(segundo).toHaveTextContent(/hace \d+ día\(s\)/);
  });

  it('AC1: pide el listado de PERDIDAS al backend', async () => {
    getReportesMock.mockResolvedValue(reportes);

    render(<RecientesZona tipo={TipoReporte.PERDIDA} />);

    await screen.findByTestId('reciente-rep-1');
    expect(getReportesMock).toHaveBeenCalledWith({
      tipo: TipoReporte.PERDIDA,
      limit: 6,
    });
  });

  it('AC2: sin resultados muestra un estado vacío explicativo, no una lista en blanco', async () => {
    getReportesMock.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 6, total: 0, totalPages: 0 },
    });

    render(<RecientesZona tipo={TipoReporte.PERDIDA} />);

    const vacio = await screen.findByTestId('sin-recientes');
    expect(vacio).toHaveTextContent(/no hay reportes de mascotas perdidas/i);
  });

  it('AC3: cada reporte es un enlace a su pantalla de detalle', async () => {
    getReportesMock.mockResolvedValue(reportes);

    render(<RecientesZona tipo={TipoReporte.PERDIDA} />);

    const primero = await screen.findByTestId('reciente-rep-1');
    expect(primero).toHaveAttribute('href', '/reportes/rep-1');
    expect(screen.getByTestId('reciente-rep-2')).toHaveAttribute(
      'href',
      '/reportes/rep-2',
    );
  });

  it('muestra un mensaje de error si el listado no se pudo cargar', async () => {
    getReportesMock.mockRejectedValue(new Error('network'));

    render(<RecientesZona tipo={TipoReporte.PERDIDA} />);

    const error = await screen.findByTestId('recientes-error');
    expect(error).toHaveTextContent(/no se pudieron cargar/i);
  });
});
