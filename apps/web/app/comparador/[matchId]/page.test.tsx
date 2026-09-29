import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EstadoReporte, TipoReporte } from '@reunipet/shared';
import ComparadorPage from '@/app/comparador/[matchId]/page';
import {
  getAlertas,
  getContacto,
  getReporte,
} from '@/lib/api';

jest.mock('@/lib/api', () => ({
  getAlertas: jest.fn(),
  getReporte: jest.fn(),
  getContacto: jest.fn(),
  descartarAlerta: jest.fn(),
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
});
