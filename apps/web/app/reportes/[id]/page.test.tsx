import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ReporteDetallePage from '@/app/reportes/[id]/page';
import HomePage from '@/app/page';
import { navegacion } from '@/lib/sesion';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'rep-1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/reportes/rep-1',
}));

// Respuesta real de GET /reportes/:id a un anónimo: sin email ni teléfono,
// esPropietario false y coordenadas ya aproximadas por el backend.
const DETALLE_ANONIMO = {
  id: 'rep-1',
  tipo: 'PERDIDA',
  especie: 'Perro',
  raza: 'Labrador',
  color: 'negro',
  caracteristicasDistintivas: 'collar rojo',
  ubicacion: 'Parque Central',
  latitud: 10.12,
  longitud: -66.99,
  estado: 'PERDIDA',
  esPropietario: false,
  createdAt: '2026-09-28T10:00:00.000Z',
  updatedAt: '2026-09-28T10:00:00.000Z',
  fotos: [],
};

function respuesta(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const BOTONES_DUENO = [
  'panel-estado',
  'btn-marcar-recuperada',
  'btn-reabrir',
  'confirmacion-recuperada',
];

let ir: jest.SpyInstance;

beforeEach(() => {
  window.localStorage.clear();
  ir = jest.spyOn(navegacion, 'ir').mockImplementation(() => undefined);
});

afterEach(() => ir.mockRestore());

describe('/reportes/[id] es público (HU16, decisión 10)', () => {
  it('un anónimo ve el detalle sin botones de dueño ni panel de estado', async () => {
    global.fetch = jest.fn().mockResolvedValue(respuesta(200, DETALLE_ANONIMO));

    render(<ReporteDetallePage />);

    expect(await screen.findByText('Detalle del reporte')).toBeInTheDocument();
    expect(screen.getByTestId('reporte-precision')).toHaveTextContent(
      /aproximada/i,
    );
    for (const id of BOTONES_DUENO) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/@|teléfono/i)).not.toBeInTheDocument();
    expect(ir).not.toHaveBeenCalled();
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('con un token vencido no lleva a /login: cierra la sesión y lo muestra como anónimo', async () => {
    window.localStorage.setItem('reunipet:token', 'jwt-vencido');
    window.localStorage.setItem('reunipet:nombre', 'Ana');
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(respuesta(401, { message: 'Tu sesión expiró' }))
      .mockResolvedValueOnce(respuesta(200, DETALLE_ANONIMO));

    render(<ReporteDetallePage />);

    expect(await screen.findByText('Detalle del reporte')).toBeInTheDocument();
    expect(ir).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('reunipet:token')).toBeNull();
    expect(screen.queryByTestId('panel-estado')).not.toBeInTheDocument();
    const segunda = (global.fetch as jest.Mock).mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(segunda[1].headers).toBeUndefined();
  });
});

describe('Inicio: listado público (HU16, decisión 10)', () => {
  it('un anónimo ve los reportes recientes con enlace al detalle', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respuesta(200, {
        items: [{ ...DETALLE_ANONIMO, foto: null }],
        meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
      }),
    );

    render(<HomePage />);

    expect(screen.getByText('Reportes recientes')).toBeInTheDocument();
    const enlace = await screen.findByRole('link', { name: /perro/i });
    expect(enlace).toHaveAttribute('href', '/reportes/rep-1');
    expect(ir).not.toHaveBeenCalled();
  });
});
