import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    render(<RecientesZona tipoInicial={TipoReporte.PERDIDA} />);

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

    render(<RecientesZona tipoInicial={TipoReporte.PERDIDA} />);

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

    render(<RecientesZona tipoInicial={TipoReporte.PERDIDA} />);

    const vacio = await screen.findByTestId('sin-recientes');
    expect(vacio).toHaveTextContent(/no hay reportes de mascotas perdidas/i);
  });

  it('AC3: cada reporte es un enlace a su pantalla de detalle', async () => {
    getReportesMock.mockResolvedValue(reportes);

    render(<RecientesZona tipoInicial={TipoReporte.PERDIDA} />);

    const primero = await screen.findByTestId('reciente-rep-1');
    expect(primero).toHaveAttribute('href', '/reportes/rep-1');
    expect(screen.getByTestId('reciente-rep-2')).toHaveAttribute(
      'href',
      '/reportes/rep-2',
    );
  });

  it('muestra un mensaje de error si el listado no se pudo cargar', async () => {
    getReportesMock.mockRejectedValue(new Error('network'));

    render(<RecientesZona tipoInicial={TipoReporte.PERDIDA} />);

    const error = await screen.findByTestId('recientes-error');
    expect(error).toHaveTextContent(/no se pudieron cargar/i);
  });

  describe('HU7 — listado de encontradas', () => {
    const encontradas: ListReportesResponse = {
      items: [
        {
          id: 'enc-1',
          tipo: TipoReporte.ENCONTRADA,
          especie: 'Canario',
          raza: null,
          color: 'amarillo',
          caracteristicasDistintivas: 'pico roto',
          estado: 'ENCONTRADA',
          ubicacion: 'Calle 5',
          latitud: null,
          longitud: null,
          esPropietario: false,
          fotoPrincipal: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
    };

    function mockPorTipo(): void {
      getReportesMock.mockImplementation(({ tipo }: { tipo: TipoReporte }) =>
        Promise.resolve(
          tipo === TipoReporte.ENCONTRADA ? encontradas : reportes,
        ),
      );
    }

    it('AC1: al pulsar "Encontradas" carga y muestra el listado de ENCONTRADA', async () => {
      mockPorTipo();

      render(<RecientesZona />);
      await screen.findByTestId('reciente-rep-1');

      fireEvent.click(screen.getByRole('button', { name: 'Encontradas' }));

      expect(getReportesMock).toHaveBeenCalledWith({
        tipo: TipoReporte.ENCONTRADA,
        limit: 6,
      });
      const enc = await screen.findByTestId('reciente-enc-1');
      expect(enc).toHaveTextContent('Canario');
      expect(enc).toHaveTextContent('amarillo');
      expect(enc).toHaveTextContent('Calle 5');
      expect(screen.queryByTestId('reciente-rep-1')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Encontradas' }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        screen.getByRole('button', { name: 'Perdidas' }),
      ).toHaveAttribute('aria-pressed', 'false');
    });

    it('AC2: el estado vacío de ENCONTRADA usa su propio mensaje', async () => {
      getReportesMock.mockImplementation(({ tipo }: { tipo: TipoReporte }) =>
        Promise.resolve(
          tipo === TipoReporte.ENCONTRADA
            ? { items: [], meta: { page: 1, limit: 6, total: 0, totalPages: 0 } }
            : reportes,
        ),
      );

      render(<RecientesZona />);
      await screen.findByTestId('reciente-rep-1');

      fireEvent.click(screen.getByRole('button', { name: 'Encontradas' }));

      const vacio = await screen.findByTestId('sin-recientes');
      expect(vacio).toHaveTextContent(/no hay reportes de mascotas encontradas/i);
    });

    it('AC3: los reportes de encontradas también enlazan a su detalle', async () => {
      mockPorTipo();

      render(<RecientesZona />);
      await screen.findByTestId('reciente-rep-1');

      fireEvent.click(screen.getByRole('button', { name: 'Encontradas' }));

      const enc = await screen.findByTestId('reciente-enc-1');
      expect(enc).toHaveAttribute('href', '/reportes/enc-1');
    });
  });

  describe('HU8 — filtros de búsqueda', () => {
    const geolocationMock = {
      getCurrentPosition: jest.fn(),
    };

    beforeEach(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: geolocationMock,
        configurable: true,
      });
      geolocationMock.getCurrentPosition.mockReset();
    });

    function escribir(id: string, value: string): void {
      fireEvent.change(screen.getByLabelText(id), {
        target: { value },
      });
    }

    it('AC1: al buscar envía especie y color combinados (AND en el mismo request)', async () => {
      getReportesMock.mockResolvedValue(reportes);

      render(<RecientesZona />);
      await screen.findByTestId('reciente-rep-1');

      escribir('Especie', 'perro');
      escribir('Color', 'negro');
      fireEvent.click(screen.getByTestId('boton-buscar'));

      await waitFor(() =>
        expect(getReportesMock).toHaveBeenCalledWith({
          tipo: TipoReporte.PERDIDA,
          limit: 6,
          especie: 'perro',
          color: 'negro',
        }),
      );
    });

    it('AC1: los tres filtros de texto viajan juntos', async () => {
      getReportesMock.mockResolvedValue(reportes);

      render(<RecientesZona />);
      await screen.findByTestId('reciente-rep-1');

      escribir('Especie', 'perro');
      escribir('Raza', 'labrador');
      escribir('Color', 'negro');
      fireEvent.click(screen.getByTestId('boton-buscar'));

      await waitFor(() =>
        expect(getReportesMock).toHaveBeenLastCalledWith({
          tipo: TipoReporte.PERDIDA,
          limit: 6,
          especie: 'perro',
          raza: 'labrador',
          color: 'negro',
        }),
      );
    });

    it('AC3: limpiar filtros vuelve al listado completo sin recargar la página', async () => {
      getReportesMock.mockResolvedValue(reportes);

      const { container } = render(<RecientesZona />);
      await screen.findByTestId('reciente-rep-1');

      escribir('Especie', 'perro');
      fireEvent.click(screen.getByTestId('boton-buscar'));
      await waitFor(() =>
        expect(getReportesMock).toHaveBeenLastCalledWith({
          tipo: TipoReporte.PERDIDA,
          limit: 6,
          especie: 'perro',
        }),
      );

      fireEvent.click(screen.getByTestId('boton-limpiar'));

      await waitFor(() =>
        expect(getReportesMock).toHaveBeenLastCalledWith({
          tipo: TipoReporte.PERDIDA,
          limit: 6,
        }),
      );
      // La página sigue montada: no hubo recarga ni desmontaje.
      expect(container.ownerDocument).toBe(document);
      expect(screen.getByTestId('reciente-rep-1')).toBeInTheDocument();
      // El input de especie volvió a quedar vacío.
      expect(screen.getByLabelText('Especie')).toHaveValue('');
    });

    it('AC2: con filtros aplicados y sin resultados informa explícitamente', async () => {
      getReportesMock.mockResolvedValue({
        items: [],
        meta: { page: 1, limit: 6, total: 0, totalPages: 0 },
      });

      render(<RecientesZona />);

      escribir('Color', 'púrpura');
      fireEvent.click(screen.getByTestId('boton-buscar'));

      const vacio = await screen.findByText(
        /no encontramos reportes que coincidan con esos filtros/i,
      );
      expect(vacio).toHaveAttribute('data-testid', 'sin-recientes');
      expect(vacio).toHaveTextContent(/limpia los filtros/i);
    });

    it('HU8: "Cerca de mí" envía lat, lng y radioKm juntos', async () => {
      getReportesMock.mockResolvedValue(reportes);
      geolocationMock.getCurrentPosition.mockImplementation(
        (ok: (pos: { coords: { latitude: number; longitude: number } }) => void) =>
          ok({ coords: { latitude: 10.5, longitude: -66.5 } }),
      );

      render(<RecientesZona />);
      await screen.findByTestId('reciente-rep-1');

      fireEvent.click(screen.getByLabelText('Cerca de mí'));
      fireEvent.click(screen.getByTestId('boton-buscar'));

      await waitFor(() =>
        expect(getReportesMock).toHaveBeenLastCalledWith({
          tipo: TipoReporte.PERDIDA,
          limit: 6,
          lat: 10.5,
          lng: -66.5,
          radioKm: 10,
        }),
      );
    });

    it('HU8: si el navegador deniega la ubicación se muestra un aviso (sin búsqueda a ciegas)', async () => {
      getReportesMock.mockResolvedValue(reportes);
      geolocationMock.getCurrentPosition.mockImplementation(
        (_ok: unknown, err: (e: unknown) => void) =>
          err(new Error('denegada')),
      );

      render(<RecientesZona />);
      await screen.findByTestId('reciente-rep-1');

      const llamadasPrevias = getReportesMock.mock.calls.length;
      fireEvent.click(screen.getByLabelText('Cerca de mí'));
      fireEvent.click(screen.getByTestId('boton-buscar'));

      const aviso = await screen.findByTestId('aviso-geo');
      expect(aviso).toHaveTextContent(/no pudimos obtener tu ubicación/i);
      // Solo la carga inicial, ninguna búsqueda con coords inventadas.
      expect(getReportesMock).toHaveBeenCalledTimes(llamadasPrevias);
    });
  });
});
