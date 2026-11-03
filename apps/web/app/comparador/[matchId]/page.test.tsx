import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EstadoReporte, TipoReporte } from '@reunipet/shared';
import ComparadorPage from '@/app/comparador/[matchId]/page';
import {
  getAlertas,
  getContacto,
  getReporte,
  marcarVista,
} from '@/lib/api';

jest.mock('@/lib/api', () => ({
  getAlertas: jest.fn(),
  getReporte: jest.fn(),
  getContacto: jest.fn(),
  descartarAlerta: jest.fn(),
  marcarVista: jest.fn().mockResolvedValue(undefined),
  fotoUrl: (url: string) => url,
}));

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ matchId: 'match-1' }),
}));

const getAlertasMock = getAlertas as jest.Mock;
const getReporteMock = getReporte as jest.Mock;
const getContactoMock = getContacto as jest.Mock;
const marcarVistaMock = marcarVista as jest.Mock;

const alerta = {
  coincidenciaId: 'match-1',
  score: 0.9,
  estado: 'PENDIENTE',
  createdAt: '2026-09-28T10:00:00.000Z',
  reportePerdida: {
    id: 'rep-perdida',
    especie: 'Perro',
    raza: 'Labrador',
    color: 'negro',
    caracteristicasDistintivas: 'collar rojo',
  },
  reporteEncontrada: {
    id: 'rep-hallazgo',
    especie: 'Perro',
    raza: 'Labrador',
    color: 'negro',
    caracteristicasDistintivas: 'collar rojo',
    ubicacion: 'Parque Central',
  },
};

const reportePerdida = {
  id: 'rep-perdida',
  tipo: TipoReporte.PERDIDA,
  especie: 'Perro',
  raza: 'Labrador',
  color: 'negro',
  caracteristicasDistintivas: 'collar rojo',
  ubicacion: null,
  latitud: null,
  longitud: null,
  esPropietario: true,
  estado: EstadoReporte.PERDIDA,
  propietarioId: 'user-1',
  createdAt: '2026-09-28T10:00:00.000Z',
  updatedAt: '2026-09-28T10:00:00.000Z',
  fotos: [],
};

const reporteEncontrada = {
  ...reportePerdida,
  id: 'rep-hallazgo',
  tipo: TipoReporte.ENCONTRADA,
  estado: EstadoReporte.ENCONTRADA,
  propietarioId: 'user-2',
  esPropietario: false,
};

describe('Comparador (HU10 — información de contacto)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAlertasMock.mockResolvedValue([alerta]);
    getReporteMock
      .mockResolvedValueOnce(reportePerdida)
      .mockResolvedValueOnce(reporteEncontrada);
  });

  it('AC1: Contactar pide el contacto del reporte de hallazgo y lo muestra', async () => {
    getContactoMock.mockResolvedValue({
      reporteId: 'rep-hallazgo',
      nombre: 'María Pérez',
      email: 'maria@test.dev',
      telefono: '04121234567',
    });

    render(<ComparadorPage />);

    const boton = await screen.findByTestId('boton-contactar');
    expect(boton).toBeEnabled();
    fireEvent.click(boton);

    await waitFor(() =>
      expect(getContactoMock).toHaveBeenCalledWith('rep-hallazgo'),
    );

    expect(await screen.findByTestId('contacto-panel')).toBeInTheDocument();
    expect(
      screen.getByText('Contacto de María Pérez'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'maria@test.dev' })).toHaveAttribute(
      'href',
      'mailto:maria@test.dev',
    );
    expect(screen.getByRole('link', { name: '04121234567' })).toHaveAttribute(
      'href',
      'tel:04121234567',
    );
  });

  it('AC1: si el backend falla muestra un mensaje de error reintentable', async () => {
    getContactoMock.mockRejectedValue(new Error('network'));

    render(<ComparadorPage />);

    fireEvent.click(await screen.findByTestId('boton-contactar'));

    expect(
      await screen.findByText(/no se pudo obtener el contacto/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('contacto-panel')).not.toBeInTheDocument();
    // Se puede reintentar.
    expect(screen.getByTestId('boton-contactar')).toBeEnabled();
  });

  it('muestra los datos de la coincidencia (regresión Sprint 2)', async () => {
    render(<ComparadorPage />);

    expect(await screen.findByText('Coincidencia Alta Detectada')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Tu Reporte')).toBeInTheDocument();
    expect(screen.getByText('Reporte Encontrado')).toBeInTheDocument();
  });

  it('HU3: muestra la fotografía del reporte de hallazgo', async () => {
    getReporteMock
      .mockReset()
      .mockResolvedValueOnce(reportePerdida)
      .mockResolvedValueOnce({
        ...reporteEncontrada,
        fotos: [
          {
            id: 'fot-enc',
            reporteId: 'rep-hallazgo',
            url: '/uploads/fot-enc.png',
            orden: 0,
            createdAt: '2026-09-28T10:00:00.000Z',
          },
        ],
      });

    render(<ComparadorPage />);

    // La foto del hallazgo aparece en la tarjeta "Reporte Encontrado".
    const foto = await screen.findByAltText(
      'Foto de la mascota encontrada',
    );
    expect(foto).toHaveAttribute('src', '/uploads/fot-enc.png');
  });

  it('HU3: sin fotos en el hallazgo muestra el mensaje de reemplazo', async () => {
    render(<ComparadorPage />);

    // Ambos reportes sin fotos: mensaje en las dos tarjetas, nunca un
    // espacio roto.
    expect(await screen.findAllByText('Sin fotografía')).toHaveLength(2);
  });
});

describe('Comparador (HU4 AC3 — abrir marca la alerta como vista)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    marcarVistaMock.mockResolvedValue({ ...alerta, estado: 'VISTA' });
    getReporteMock
      .mockResolvedValueOnce(reportePerdida)
      .mockResolvedValueOnce(reporteEncontrada);
  });

  it('abrir una alerta PENDIENTE llama a marcarVista una sola vez', async () => {
    getAlertasMock.mockResolvedValue([alerta]);
    render(<ComparadorPage />);
    await screen.findByTestId('boton-contactar');
    await waitFor(() => expect(marcarVistaMock).toHaveBeenCalledTimes(1));
    expect(marcarVistaMock).toHaveBeenCalledWith('match-1');
  });

  it('reabrir una alerta ya VISTA no vuelve a llamar al API', async () => {
    getAlertasMock.mockResolvedValue([{ ...alerta, estado: 'VISTA' }]);
    render(<ComparadorPage />);
    await screen.findByTestId('boton-contactar');
    expect(marcarVistaMock).not.toHaveBeenCalled();
  });

  it('si marcarVista falla, el comparador se muestra igual', async () => {
    getAlertasMock.mockResolvedValue([alerta]);
    marcarVistaMock.mockRejectedValue(new Error('caído'));
    render(<ComparadorPage />);
    expect(await screen.findByTestId('boton-contactar')).toBeEnabled();
  });
});
