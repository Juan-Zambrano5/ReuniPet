import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import {
  EstadoReporte,
  MiReporteItem,
  TipoReporte,
} from '@reunipet/shared';
import { MisReportes } from '@/components/reportes/MisReportes';
import { getMisReportes } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  getMisReportes: jest.fn(),
  fotoUrl: (u: string) => u,
}));

const getMisReportesMock = getMisReportes as jest.Mock;

function item(over: Partial<MiReporteItem>): MiReporteItem {
  return {
    id: 'r-1',
    tipo: TipoReporte.PERDIDA,
    especie: 'Perro',
    raza: 'Labrador',
    color: 'Negro',
    caracteristicasDistintivas: 'Collar',
    estado: EstadoReporte.PERDIDA,
    ubicacion: null,
    latitud: null,
    longitud: null,
    esPropietario: true,
    moderado: false,
    motivoModeracion: null,
    fotoPrincipal: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    coincidenciasPendientes: 0,
    ...over,
  };
}

beforeEach(() => getMisReportesMock.mockReset());

describe('MisReportes (HU15)', () => {
  it('AC1: muestra todos los reportes (incluidos recuperados) en el orden recibido, con foto, especie, estado y fecha', async () => {
    getMisReportesMock.mockResolvedValue([
      item({
        id: 'nuevo',
        fotoPrincipal: {
          id: 'f',
          reporteId: 'nuevo',
          url: '/files/a.webp',
          orden: 0,
          createdAt: '2026-11-01T10:00:00.000Z',
        },
      }),
      item({
        id: 'enc',
        tipo: TipoReporte.ENCONTRADA,
        estado: EstadoReporte.ENCONTRADA,
        especie: 'Gato',
        raza: null,
      }),
      item({ id: 'viejo', estado: EstadoReporte.RECUPERADA }),
    ]);

    render(<MisReportes />);

    const items = await screen.findAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-testid'))).toEqual([
      'mi-reporte-nuevo',
      'mi-reporte-enc',
      'mi-reporte-viejo',
    ]);
    const primero = within(items[0]);
    expect(primero.getByRole('img', { name: 'Foto de Perro' })).toHaveAttribute(
      'src',
      '/files/a.webp',
    );
    expect(primero.getByText('PERDIDO')).toBeInTheDocument();
    expect(primero.getByText(/2026/)).toBeInTheDocument();
    expect(within(items[1]).getByText('ENCONTRADO')).toBeInTheDocument();
    expect(within(items[1]).getByText('Gato')).toBeInTheDocument();
    expect(within(items[2]).getByText('RECUPERADO')).toBeInTheDocument();
    // Cada tarjeta lleva al detalle del reporte.
    expect(primero.getAllByRole('link')[0]).toHaveAttribute(
      'href',
      '/reportes/nuevo',
    );
  });

  it('AC2: muestra cuántas coincidencias hay y enlaza a /alertas', async () => {
    getMisReportesMock.mockResolvedValue([
      item({ id: 'a', coincidenciasPendientes: 2 }),
      item({ id: 'b', coincidenciasPendientes: 1 }),
      item({ id: 'c', coincidenciasPendientes: 0 }),
    ]);

    render(<MisReportes />);

    const a = await screen.findByTestId('coincidencias-a');
    expect(a).toHaveTextContent('2 posibles coincidencias');
    expect(a).toHaveAttribute('href', '/alertas');
    expect(screen.getByTestId('coincidencias-b')).toHaveTextContent(
      '1 posible coincidencia',
    );
    expect(screen.queryByTestId('coincidencias-c')).not.toBeInTheDocument();
  });

  it('AC3: sin reportes invita a crear uno', async () => {
    getMisReportesMock.mockResolvedValue([]);

    render(<MisReportes />);

    expect(await screen.findByTestId('mis-reportes-vacio')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Reportar mascota' }),
    ).toHaveAttribute('href', '/reportar/perdida');
  });

  it('si el API falla muestra un error', async () => {
    getMisReportesMock.mockRejectedValue(new Error('caído'));

    render(<MisReportes />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar tus reportes',
    );
  });
});

describe('MisReportes (HU18)', () => {
  it('AC1: el dueño ve su reporte oculto con la etiqueta "Oculto por moderación"', async () => {
    getMisReportesMock.mockResolvedValue([
      item({ id: 'oculto', moderado: true, motivoModeracion: 'Duplicado' }),
      item({ id: 'visible' }),
    ]);
    render(<MisReportes />);

    const oculto = await screen.findByTestId('mi-reporte-oculto');
    expect(within(oculto).getByText('Oculto por moderación')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('mi-reporte-visible')).queryByText(
        'Oculto por moderación',
      ),
    ).not.toBeInTheDocument();
  });
});
