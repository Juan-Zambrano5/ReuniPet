import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EstadoReporte, ReporteResponse, TipoReporte } from '@reunipet/shared';
import {
  EditarReporte,
  MENSAJE_SIN_CAMBIOS,
  MENSAJE_SIN_PERMISO,
} from '@/components/reportes/EditarReporte';
import {
  ApiError,
  actualizarReporte,
  actualizarUbicacion,
  getReporte,
} from '@/lib/api';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/lib/api', () => ({
  getReporte: jest.fn(),
  actualizarReporte: jest.fn(),
  actualizarUbicacion: jest.fn(),
  ApiError: jest.requireActual('@/lib/api').ApiError,
  extractFieldErrors: jest.requireActual('@/lib/api').extractFieldErrors,
}));

const getReporteMock = getReporte as jest.Mock;
const actualizarReporteMock = actualizarReporte as jest.Mock;
const actualizarUbicacionMock = actualizarUbicacion as jest.Mock;

const reporte: ReporteResponse = {
  id: 'rep-1',
  tipo: TipoReporte.PERDIDA,
  especie: 'Perro',
  raza: 'Labrador',
  color: 'negro',
  caracteristicasDistintivas: 'collar rojo',
  ubicacion: 'Parque Central',
  latitud: null,
  longitud: null,
  esPropietario: true,
  moderado: false,
  motivoModeracion: null,
  estado: EstadoReporte.PERDIDA,
  createdAt: '2026-09-28T10:00:00.000Z',
  updatedAt: '2026-09-28T10:00:00.000Z',
  fotos: [],
};

async function abrir(datos: ReporteResponse = reporte): Promise<void> {
  getReporteMock.mockResolvedValue(datos);
  render(<EditarReporte id="rep-1" />);
  await screen.findByTestId('editar-form');
}

function guardar(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  actualizarReporteMock.mockResolvedValue(reporte);
  actualizarUbicacionMock.mockResolvedValue(reporte);
});

describe('EditarReporte (HU17)', () => {
  it('carga los datos actuales en el formulario', async () => {
    await abrir();
    expect(screen.getByLabelText('Color')).toHaveValue('negro');
    expect(screen.getByLabelText(/raza/i)).toHaveValue('Labrador');
    // "Perro" guardado se muestra con la opción "perro" del selector.
    expect(screen.getByRole('radio', { name: 'perro' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('guardar envía solo los campos cambiados y vuelve al detalle', async () => {
    await abrir();
    fireEvent.change(screen.getByLabelText('Color'), {
      target: { value: ' blanco ' },
    });
    fireEvent.change(screen.getByLabelText(/raza/i), { target: { value: '' } });
    guardar();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/reportes/rep-1'));
    expect(actualizarReporteMock).toHaveBeenCalledWith('rep-1', {
      color: 'blanco',
      raza: null,
    });
    expect(actualizarUbicacionMock).not.toHaveBeenCalled();
  });

  it('cambiar la especie la envía; mover el punto usa PATCH /ubicacion', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('radio', { name: 'gato' }));
    fireEvent.keyDown(screen.getByTestId('mapa-mock'), { key: 'Enter' });
    guardar();

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(actualizarReporteMock).toHaveBeenCalledWith('rep-1', {
      especie: 'gato',
    });
    expect(actualizarUbicacionMock).toHaveBeenCalledWith(
      'rep-1',
      expect.objectContaining({
        latitud: expect.any(Number),
        longitud: expect.any(Number),
        ubicacion: 'Parque Central',
      }),
    );
  });

  it('sin cambios no llama al API y lo avisa', async () => {
    await abrir();
    guardar();
    expect(await screen.findByText(MENSAJE_SIN_CAMBIOS)).toBeInTheDocument();
    expect(actualizarReporteMock).not.toHaveBeenCalled();
    expect(actualizarUbicacionMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('cambiar el texto de ubicación sin punto en el mapa pide marcarlo', async () => {
    await abrir();
    fireEvent.change(screen.getByLabelText(/ubicación de referencia/i), {
      target: { value: 'Av. 5' },
    });
    guardar();
    expect(
      await screen.findByText(/marca un punto en el mapa/i),
    ).toBeInTheDocument();
    expect(actualizarUbicacionMock).not.toHaveBeenCalled();
  });

  it('un 403 muestra un mensaje claro y no navega', async () => {
    actualizarReporteMock.mockRejectedValue(
      new ApiError(403, { message: 'Solo el propietario puede editar este reporte' }),
    );
    await abrir();
    fireEvent.change(screen.getByLabelText('Color'), {
      target: { value: 'gris' },
    });
    guardar();

    expect(await screen.findByText(MENSAJE_SIN_PERMISO)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('valida en cliente que color y características no queden vacíos', async () => {
    await abrir();
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: ' ' } });
    guardar();
    expect(await screen.findByText('El color es obligatorio')).toBeInTheDocument();
    expect(actualizarReporteMock).not.toHaveBeenCalled();
  });

  it('si el reporte no es tuyo no muestra el formulario', async () => {
    getReporteMock.mockResolvedValue({ ...reporte, esPropietario: false });
    render(<EditarReporte id="rep-1" />);

    expect(await screen.findByTestId('editar-bloqueado')).toHaveTextContent(
      MENSAJE_SIN_PERMISO,
    );
    expect(screen.queryByTestId('editar-form')).not.toBeInTheDocument();
  });
});
