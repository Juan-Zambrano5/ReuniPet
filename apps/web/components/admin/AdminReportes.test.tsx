import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  AdminReporteItem,
  EstadoReporte,
  TipoReporte,
} from '@reunipet/shared';
import {
  AdminReportes,
  MENSAJE_MOTIVO,
  MENSAJE_SOLO_ADMIN,
} from '@/components/admin/AdminReportes';
import AdminPage from '@/app/admin/page';
import { ApiError, getAdminReportes, moderarReporte } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  getAdminReportes: jest.fn(),
  moderarReporte: jest.fn(),
  ApiError: jest.requireActual('@/lib/api').ApiError,
}));

const getMock = getAdminReportes as jest.Mock;
const moderarMock = moderarReporte as jest.Mock;

function item(over: Partial<AdminReporteItem> = {}): AdminReporteItem {
  return {
    id: 'r-1',
    tipo: TipoReporte.ENCONTRADA,
    especie: 'Perro',
    raza: null,
    color: 'negro',
    caracteristicasDistintivas: 'collar',
    estado: EstadoReporte.ENCONTRADA,
    ubicacion: 'Parque',
    latitud: null,
    longitud: null,
    esPropietario: false,
    moderado: false,
    motivoModeracion: null,
    fotoPrincipal: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    propietarioNombre: 'Ana',
    propietarioEmail: 'ana@test.dev',
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

describe('AdminReportes (HU18)', () => {
  it('lista los reportes con su dueño', async () => {
    getMock.mockResolvedValue([item()]);
    render(<AdminReportes />);
    const fila = await screen.findByTestId('admin-reporte-r-1');
    expect(fila).toHaveTextContent('Ana · ana@test.dev');
    expect(getMock).toHaveBeenCalledWith(false);
  });

  it('AC1: ocultar exige motivo antes de llamar al API', async () => {
    getMock.mockResolvedValue([item()]);
    render(<AdminReportes />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ocultar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText(MENSAJE_MOTIVO)).toBeInTheDocument();
    expect(moderarMock).not.toHaveBeenCalled();
  });

  it('AC1: ocultar con motivo lo marca como oculto', async () => {
    getMock.mockResolvedValue([item()]);
    moderarMock.mockResolvedValue(
      item({ moderado: true, motivoModeracion: 'Duplicado' }),
    );
    render(<AdminReportes />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ocultar' }));
    fireEvent.change(screen.getByLabelText('Motivo para ocultarlo'), {
      target: { value: ' Duplicado ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    const fila = screen.getByTestId('admin-reporte-r-1');
    expect(
      await within(fila).findByText('Oculto por moderación'),
    ).toBeInTheDocument();
    expect(fila).toHaveTextContent('Motivo: Duplicado');
    expect(moderarMock).toHaveBeenCalledWith('r-1', {
      moderado: true,
      motivo: 'Duplicado',
    });
    expect(within(fila).getByRole('button', { name: 'Restaurar' })).toBeInTheDocument();
  });

  it('AC2: en "Solo ocultos", restaurar lo quita de la lista', async () => {
    getMock.mockResolvedValue([
      item({ moderado: true, motivoModeracion: 'Spam' }),
    ]);
    moderarMock.mockResolvedValue(item());
    render(<AdminReportes />);
    await screen.findByTestId('admin-reporte-r-1');
    fireEvent.click(screen.getByRole('button', { name: 'Solo ocultos' }));
    expect(getMock).toHaveBeenLastCalledWith(true);

    fireEvent.click(await screen.findByRole('button', { name: 'Restaurar' }));

    expect(await screen.findByText('No hay reportes ocultos.')).toBeInTheDocument();
    expect(moderarMock).toHaveBeenCalledWith('r-1', { moderado: false });
  });

  it('AC3: un 403 muestra que la sección es solo para administradores', async () => {
    getMock.mockRejectedValue(new ApiError(403, {}));
    render(<AdminReportes />);
    expect(await screen.findByTestId('admin-error')).toHaveTextContent(
      MENSAJE_SOLO_ADMIN,
    );
  });

  it('AC3: con rol ADMIN guardado pero 403 de la API, /admin muestra "No tienes acceso"', async () => {
    // El rol en localStorage solo decide la barra; manda la respuesta del API.
    window.localStorage.setItem('reunipet:token', 'jwt');
    window.localStorage.setItem('reunipet:rol', 'ADMIN');
    getMock.mockRejectedValue(new ApiError(403, {}));

    render(<AdminPage />);

    expect(await screen.findByTestId('admin-error')).toHaveTextContent(
      'No tienes acceso',
    );
    expect(screen.queryByRole('list', { name: 'Reportes' })).not.toBeInTheDocument();
  });
});
