import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AlertasPage from '@/app/alertas/page';
import { descartarAlerta, getAlertas } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  getAlertas: jest.fn(),
  descartarAlerta: jest.fn(),
  getReportes: jest.fn().mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 6, total: 0, totalPages: 0 },
  }),
  fotoUrl: (u: string) => u,
}));

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const getAlertasMock = getAlertas as jest.Mock;
const descartarMock = descartarAlerta as jest.Mock;

function alerta(id: string, estado: 'PENDIENTE' | 'VISTA') {
  return {
    coincidenciaId: id,
    score: 1,
    estado,
    createdAt: '2026-11-01T10:00:00.000Z',
    reportePerdida: {
      id: `p-${id}`,
      especie: 'Perro',
      raza: 'Labrador',
      color: 'Negro',
      caracteristicasDistintivas: 'collar',
    },
    reporteEncontrada: {
      id: `e-${id}`,
      especie: 'Perro',
      raza: 'Labrador',
      color: 'Negro',
      ubicacion: 'Parque',
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('/alertas (HU4 AC3)', () => {
  it('una alerta VISTA no aparece como nueva', async () => {
    getAlertasMock.mockResolvedValue([
      alerta('a', 'PENDIENTE'),
      alerta('b', 'VISTA'),
    ]);
    render(<AlertasPage />);

    const nueva = await screen.findByTestId('alerta-a');
    expect(within(nueva).getByTestId('alerta-estado')).toHaveTextContent('Nueva');
    expect(
      within(screen.getByTestId('alerta-b')).getByTestId('alerta-estado'),
    ).toHaveTextContent('Vista');
  });

  it('Descartar llama a /descartar y oculta la alerta', async () => {
    getAlertasMock.mockResolvedValue([alerta('a', 'PENDIENTE')]);
    descartarMock.mockResolvedValue(undefined);
    render(<AlertasPage />);

    const card = await screen.findByTestId('alerta-a');
    fireEvent.click(within(card).getByRole('button', { name: /descartar/i }));

    await waitFor(() =>
      expect(screen.queryByTestId('alerta-a')).not.toBeInTheDocument(),
    );
    expect(descartarMock).toHaveBeenCalledWith('a');
  });

  it('si descartar falla, la alerta sigue visible con un error', async () => {
    getAlertasMock.mockResolvedValue([alerta('a', 'PENDIENTE')]);
    descartarMock.mockRejectedValue(new Error('caído'));
    render(<AlertasPage />);

    const card = await screen.findByTestId('alerta-a');
    fireEvent.click(within(card).getByRole('button', { name: /descartar/i }));

    expect(await screen.findByText(/no se pudo descartar/i)).toBeInTheDocument();
    expect(screen.getByTestId('alerta-a')).toBeInTheDocument();
  });
});
