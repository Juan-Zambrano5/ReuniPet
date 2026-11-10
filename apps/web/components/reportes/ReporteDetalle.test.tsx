import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { EstadoReporte, ReporteResponse, TipoReporte } from '@reunipet/shared';
import { ReporteDetalle } from '@/components/reportes/ReporteDetalle';
import { ApiError, cambiarEstadoReporte, getReporte } from '@/lib/api';
import { capasDe, ultimoMapa } from '@/__mocks__/leaflet';

jest.mock('@/lib/api', () => ({
  getReporte: jest.fn(),
  cambiarEstadoReporte: jest.fn(),
  fotoUrl: (url: string) => url,
  ApiError: jest.requireActual('@/lib/api').ApiError,
}));

const getReporteMock = getReporte as jest.Mock;
const cambiarEstadoReporteMock = cambiarEstadoReporte as jest.Mock;

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
  moderado: false,
  motivoModeracion: null,
  estado: EstadoReporte.PERDIDA,
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

  describe('HU13: mapa de la ubicación', () => {
    // El frontend no distingue tercero de anónimo: a ambos el API les manda
    // esPropietario=false y coordenadas ya aproximadas (cubierto en las e2e).
    it('tercero o anónimo: círculo de ~1 km, sin marcador ni coordenadas en números', async () => {
      getReporteMock.mockResolvedValue(reporte);
      render(<ReporteDetalle id="rep-1" />);

      await screen.findByTestId('mapa-ubicacion');
      const mapa = ultimoMapa();
      expect(capasDe(mapa, 'marker')).toHaveLength(0);
      const [zona] = capasDe(mapa, 'circle');
      expect(zona.latlng).toEqual({ lat: 10.12, lng: -66.99 });
      expect(zona.opciones.radius).toBe(1000);
      expect(screen.getByTestId('reporte-precision')).toHaveTextContent(
        'Zona aproximada',
      );
      expect(screen.queryByTestId('reporte-coordenadas')).not.toBeInTheDocument();
      expect(document.body).not.toHaveTextContent('10.12');
      expect(document.body).not.toHaveTextContent('-66.99');
    });

    it('dueño: marcador en el punto exacto con "Punto exacto"', async () => {
      getReporteMock.mockResolvedValue({
        ...reporte,
        latitud: 10.12345,
        longitud: -66.98765,
        esPropietario: true,
        moderado: false,
        motivoModeracion: null,
      });
      render(<ReporteDetalle id="rep-1" />);

      await screen.findByTestId('mapa-ubicacion');
      const mapa = ultimoMapa();
      expect(capasDe(mapa, 'circle')).toHaveLength(0);
      expect(capasDe(mapa, 'marker')[0].latlng).toEqual({
        lat: 10.12345,
        lng: -66.98765,
      });
      expect(mapa.centro).toEqual({ lat: 10.12345, lng: -66.98765 });
      expect(screen.getByTestId('reporte-precision')).toHaveTextContent(
        'Punto exacto',
      );
      expect(screen.getByTestId('reporte-coordenadas')).toHaveTextContent(
        '10.12345, -66.98765',
      );
    });

    it('sin coordenadas no hay mapa, solo el texto de ubicación', async () => {
      getReporteMock.mockResolvedValue({
        ...reporte,
        latitud: null,
        longitud: null,
      });
      render(<ReporteDetalle id="rep-1" />);

      expect(await screen.findByText('Parque Central')).toBeInTheDocument();
      expect(screen.queryByTestId('mapa-ubicacion')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mapa-cargando')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reporte-precision')).not.toBeInTheDocument();
    });
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

  it('AC1: la foto principal se adapta a su proporción y no se recorta', async () => {
    getReporteMock.mockResolvedValue(reporte);

    render(<ReporteDetalle id="rep-1" />);

    const img = await screen.findByTestId('foto-principal');
    expect(img).toHaveClass('object-contain', 'h-auto', 'max-w-full');
    expect(img).not.toHaveClass('object-cover');
    // Con foto, la caja no tiene alto fijo: toma la altura de la imagen.
    expect(screen.getByTestId('galeria-principal')).not.toHaveClass('h-64');
  });

  it('AC1: en un reporte de pérdida muestra "Mascota perdida"', async () => {
    getReporteMock.mockResolvedValue(reporte);

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('reporte-tipo')).toHaveTextContent(
      'Mascota perdida',
    );
  });

  it('AC1: en un reporte de hallazgo muestra "Mascota encontrada" y su fotografía', async () => {
    getReporteMock.mockResolvedValue({
      ...reporte,
      tipo: TipoReporte.ENCONTRADA,
      estado: EstadoReporte.ENCONTRADA,
    });

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('reporte-tipo')).toHaveTextContent(
      'Mascota encontrada',
    );
    // La foto del reporte de hallazgo también se muestra en el detalle.
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/files/perro.jpg',
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

describe('ReporteDetalle (HU11)', () => {
  const dueno: ReporteResponse = { ...reporte, esPropietario: true };

  beforeEach(() => {
    getReporteMock.mockReset();
    cambiarEstadoReporteMock.mockReset();
  });

  it('el panel de estado se muestra solo si eres el propietario', async () => {
    getReporteMock.mockResolvedValue(dueno);

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('panel-estado')).toBeInTheDocument();
    expect(screen.getByTestId('btn-marcar-recuperada')).toBeInTheDocument();
  });

  it('un tercero no ve el panel de estado', async () => {
    getReporteMock.mockResolvedValue(reporte);

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByText('Detalle del reporte')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-estado')).not.toBeInTheDocument();
  });

  it('AC1: marcar como recuperada pide confirmación y cancelar no llama al API', async () => {
    getReporteMock.mockResolvedValue(dueno);

    render(<ReporteDetalle id="rep-1" />);

    fireEvent.click(await screen.findByTestId('btn-marcar-recuperada'));
    expect(screen.getByTestId('confirmacion-recuperada')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByTestId('confirmacion-recuperada')).not.toBeInTheDocument();
    expect(cambiarEstadoReporteMock).not.toHaveBeenCalled();
  });

  it('AC1: al confirmar, cambia el estado en pantalla sin reemplazar el reporte', async () => {
    getReporteMock.mockResolvedValue(dueno);
    cambiarEstadoReporteMock.mockResolvedValue({
      id: 'rep-1',
      estado: EstadoReporte.RECUPERADA,
      updatedAt: '2026-10-02T10:00:00.000Z',
    });

    render(<ReporteDetalle id="rep-1" />);

    fireEvent.click(await screen.findByTestId('btn-marcar-recuperada'));
    fireEvent.click(screen.getByTestId('btn-confirmar-recuperada'));

    expect(await screen.findByTestId('estado-recuperada')).toBeInTheDocument();
    expect(cambiarEstadoReporteMock).toHaveBeenCalledWith(
      'rep-1',
      EstadoReporte.RECUPERADA,
    );
    // El badge refleja el nuevo estado y el resto de los datos permanece
    // (el PATCH no trae fotos: solo se actualiza estado/updatedAt).
    expect(screen.getByTestId('status-badge')).toHaveTextContent('RECUPERADO');
    expect(screen.getByText('negro')).toBeInTheDocument();
    expect(screen.getByText('collar rojo')).toBeInTheDocument();
  });

  it('si el API falla, se muestra un error y el reporte conserva su estado', async () => {
    getReporteMock.mockResolvedValue(dueno);
    cambiarEstadoReporteMock.mockRejectedValue(new ApiError(403, {}));

    render(<ReporteDetalle id="rep-1" />);

    fireEvent.click(await screen.findByTestId('btn-marcar-recuperada'));
    fireEvent.click(screen.getByTestId('btn-confirmar-recuperada'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no se pudo actualizar el estado/i,
    );
    expect(screen.getByTestId('status-badge')).toHaveTextContent('PERDIDO');
    // La confirmación queda abierta para poder reintentar o cancelar.
    expect(screen.getByTestId('btn-confirmar-recuperada')).toBeInTheDocument();
  });
});

describe('ReporteDetalle (HU14)', () => {
  const duenoRecuperada: ReporteResponse = {
    ...reporte,
    esPropietario: true,
    moderado: false,
    motivoModeracion: null,
    estado: EstadoReporte.RECUPERADA,
  };

  beforeEach(() => {
    getReporteMock.mockReset();
    cambiarEstadoReporteMock.mockReset();
  });

  it('un reporte RECUPERADA del propietario muestra el botón "Reabrir reporte"', async () => {
    getReporteMock.mockResolvedValue(duenoRecuperada);

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('btn-reabrir')).toBeInTheDocument();
    expect(screen.getByTestId('estado-recuperada')).toHaveTextContent(
      /no aparece en los listados/i,
    );
  });

  it('reabrir pide confirmación y cancelar no llama al API', async () => {
    getReporteMock.mockResolvedValue(duenoRecuperada);

    render(<ReporteDetalle id="rep-1" />);

    fireEvent.click(await screen.findByTestId('btn-reabrir'));
    expect(screen.getByTestId('confirmacion-reabrir')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByTestId('confirmacion-reabrir')).not.toBeInTheDocument();
    expect(cambiarEstadoReporteMock).not.toHaveBeenCalled();
  });

  it('al confirmar, un reporte PERDIDA vuelve a PERDIDA conservando los datos', async () => {
    getReporteMock.mockResolvedValue(duenoRecuperada);
    cambiarEstadoReporteMock.mockResolvedValue({
      id: 'rep-1',
      estado: EstadoReporte.PERDIDA,
      updatedAt: '2026-10-03T10:00:00.000Z',
    });

    render(<ReporteDetalle id="rep-1" />);

    fireEvent.click(await screen.findByTestId('btn-reabrir'));
    fireEvent.click(screen.getByTestId('btn-confirmar-reabrir'));

    expect(await screen.findByTestId('btn-marcar-recuperada')).toBeInTheDocument();
    expect(cambiarEstadoReporteMock).toHaveBeenCalledWith(
      'rep-1',
      EstadoReporte.PERDIDA,
    );
    expect(screen.getByTestId('status-badge')).toHaveTextContent('PERDIDO');
    expect(screen.getByText('negro')).toBeInTheDocument();
    expect(screen.getByText('collar rojo')).toBeInTheDocument();
  });

  it('un reporte ENCONTRADA recuperado se reabre como ENCONTRADA', async () => {
    getReporteMock.mockResolvedValue({
      ...duenoRecuperada,
      tipo: TipoReporte.ENCONTRADA,
    });
    cambiarEstadoReporteMock.mockResolvedValue({
      id: 'rep-1',
      estado: EstadoReporte.ENCONTRADA,
      updatedAt: '2026-10-03T10:00:00.000Z',
    });

    render(<ReporteDetalle id="rep-1" />);

    fireEvent.click(await screen.findByTestId('btn-reabrir'));
    fireEvent.click(screen.getByTestId('btn-confirmar-reabrir'));

    expect(await screen.findByTestId('status-badge')).toHaveTextContent(
      'ENCONTRADO',
    );
    expect(cambiarEstadoReporteMock).toHaveBeenCalledWith(
      'rep-1',
      EstadoReporte.ENCONTRADA,
    );
  });

  it('si el API falla al reabrir, se muestra un error y el reporte sigue recuperado', async () => {
    getReporteMock.mockResolvedValue(duenoRecuperada);
    cambiarEstadoReporteMock.mockRejectedValue(new ApiError(403, {}));

    render(<ReporteDetalle id="rep-1" />);

    fireEvent.click(await screen.findByTestId('btn-reabrir'));
    fireEvent.click(screen.getByTestId('btn-confirmar-reabrir'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no se pudo actualizar el estado/i,
    );
    expect(screen.getByTestId('status-badge')).toHaveTextContent('RECUPERADO');
  });
});

describe('ReporteDetalle (HU17)', () => {
  beforeEach(() => {
    getReporteMock.mockReset();
  });

  it('el propietario ve el enlace "Editar información" a /reportes/[id]/editar', async () => {
    getReporteMock.mockResolvedValue({ ...reporte, esPropietario: true });

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByTestId('enlace-editar')).toHaveAttribute(
      'href',
      '/reportes/rep-1/editar',
    );
  });

  it('un tercero o un anónimo no ve el enlace de edición', async () => {
    getReporteMock.mockResolvedValue(reporte);

    render(<ReporteDetalle id="rep-1" />);

    expect(await screen.findByText('Detalle del reporte')).toBeInTheDocument();
    expect(screen.queryByTestId('enlace-editar')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /editar/i }),
    ).not.toBeInTheDocument();
  });
});

describe('ReporteDetalle (HU18)', () => {
  it('AC1: al dueño le avisa que está oculto y por qué', async () => {
    getReporteMock.mockResolvedValue({
      ...reporte,
      esPropietario: true,
      moderado: true,
      motivoModeracion: 'Información duplicada',
    });
    render(<ReporteDetalle id="rep-1" />);

    const aviso = await screen.findByTestId('aviso-moderado');
    expect(aviso).toHaveTextContent('Oculto por moderación');
    expect(aviso).toHaveTextContent('Motivo: Información duplicada');
  });

  it('un reporte visible no muestra el aviso', async () => {
    getReporteMock.mockResolvedValue(reporte);
    render(<ReporteDetalle id="rep-1" />);
    await screen.findByText('Detalle del reporte');
    expect(screen.queryByTestId('aviso-moderado')).not.toBeInTheDocument();
  });
});
