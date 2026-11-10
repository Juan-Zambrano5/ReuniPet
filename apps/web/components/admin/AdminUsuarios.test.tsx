import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AdminUsuarioItem, RolUsuario } from '@reunipet/shared';
import AdminPage from '@/app/admin/page';
import {
  ApiError,
  cambiarActivoUsuario,
  getAdminReportes,
  getAdminUsuarios,
} from '@/lib/api';

jest.mock('@/lib/api', () => ({
  getAdminReportes: jest.fn(),
  moderarReporte: jest.fn(),
  getAdminUsuarios: jest.fn(),
  cambiarActivoUsuario: jest.fn(),
  ApiError: jest.requireActual('@/lib/api').ApiError,
}));

const reportesMock = getAdminReportes as jest.Mock;
const usuariosMock = getAdminUsuarios as jest.Mock;
const cambiarMock = cambiarActivoUsuario as jest.Mock;

function usuario(over: Partial<AdminUsuarioItem> = {}): AdminUsuarioItem {
  return {
    id: 'u-1',
    nombre: 'Ana',
    email: 'ana@test.dev',
    rol: RolUsuario.USUARIO,
    activo: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    totalReportes: 2,
    ...over,
  };
}

async function abrirUsuarios(): Promise<void> {
  render(<AdminPage />);
  fireEvent.click(screen.getByRole('tab', { name: 'Usuarios' }));
  await screen.findByRole('table', { name: 'Usuarios registrados' });
}

beforeEach(() => {
  jest.clearAllMocks();
  reportesMock.mockResolvedValue([]);
});

describe('Administración: pestaña Usuarios (HU19)', () => {
  it('las pestañas Reportes y Usuarios; Reportes abre por defecto', async () => {
    usuariosMock.mockResolvedValue([]);
    render(<AdminPage />);
    expect(screen.getByRole('tab', { name: 'Reportes' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Usuarios' }));
    expect(screen.getByRole('tab', { name: 'Usuarios' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(usuariosMock).toHaveBeenCalled();
  });

  it('AC3: la tabla muestra nombre, correo, rol, estado y número de reportes', async () => {
    usuariosMock.mockResolvedValue([
      usuario(),
      usuario({ id: 'u-2', nombre: 'Beto', activo: false, totalReportes: 0 }),
    ]);
    await abrirUsuarios();

    const ana = screen.getByTestId('admin-usuario-u-1');
    expect(ana).toHaveTextContent('Ana');
    expect(ana).toHaveTextContent('ana@test.dev');
    expect(ana).toHaveTextContent('Usuario');
    expect(ana).toHaveTextContent('Activo');
    expect(ana).toHaveTextContent('2');
    expect(screen.getByTestId('admin-usuario-u-2')).toHaveTextContent(
      'Suspendido',
    );
  });

  it('AC1: "Suspender" pide confirmación; cancelar no llama al API', async () => {
    usuariosMock.mockResolvedValue([usuario()]);
    cambiarMock.mockResolvedValue(usuario({ activo: false }));
    await abrirUsuarios();
    const fila = screen.getByTestId('admin-usuario-u-1');

    fireEvent.click(within(fila).getByRole('button', { name: 'Suspender' }));
    expect(within(fila).getByText(/¿Suspender a Ana\?/)).toBeInTheDocument();
    fireEvent.click(within(fila).getByRole('button', { name: 'Cancelar' }));
    expect(cambiarMock).not.toHaveBeenCalled();

    fireEvent.click(within(fila).getByRole('button', { name: 'Suspender' }));
    fireEvent.click(within(fila).getByRole('button', { name: 'Confirmar' }));
    expect(await within(fila).findByText('Suspendido')).toBeInTheDocument();
    expect(cambiarMock).toHaveBeenCalledWith('u-1', { activo: false });
    expect(within(fila).getByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
  });

  it('AC2: "Reactivar" no pide confirmación', async () => {
    usuariosMock.mockResolvedValue([usuario({ activo: false })]);
    cambiarMock.mockResolvedValue(usuario());
    await abrirUsuarios();
    const fila = screen.getByTestId('admin-usuario-u-1');

    fireEvent.click(within(fila).getByRole('button', { name: 'Reactivar' }));
    expect(await within(fila).findByText('Activo')).toBeInTheDocument();
    expect(cambiarMock).toHaveBeenCalledWith('u-1', { activo: true });
  });

  it('las filas de administradores no tienen botón', async () => {
    usuariosMock.mockResolvedValue([
      usuario({ id: 'a-1', nombre: 'Admin', rol: RolUsuario.ADMIN }),
    ]);
    await abrirUsuarios();
    const fila = screen.getByTestId('admin-usuario-a-1');
    expect(fila).toHaveTextContent('Administrador');
    expect(within(fila).queryByRole('button')).not.toBeInTheDocument();
  });

  it('un 400 del API muestra su mensaje en la fila', async () => {
    usuariosMock.mockResolvedValue([usuario()]);
    cambiarMock.mockRejectedValue(
      new ApiError(400, { message: 'No se puede suspender a un administrador' }),
    );
    await abrirUsuarios();
    const fila = screen.getByTestId('admin-usuario-u-1');
    fireEvent.click(within(fila).getByRole('button', { name: 'Suspender' }));
    fireEvent.click(within(fila).getByRole('button', { name: 'Confirmar' }));
    expect(
      await within(fila).findByText('No se puede suspender a un administrador'),
    ).toBeInTheDocument();
  });

  it('un 403 muestra "No tienes acceso"', async () => {
    usuariosMock.mockRejectedValue(new ApiError(403, {}));
    render(<AdminPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Usuarios' }));
    expect(await screen.findByTestId('admin-error')).toHaveTextContent(
      'No tienes acceso',
    );
  });
});
