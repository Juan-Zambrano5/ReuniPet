import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FotosCarga } from '@/components/fotos/FotosCarga';

const push = jest.fn();
const replace = jest.fn();
/** Ruta actual de la página (mock de usePathname). */
let mockPathname = '/reportar/perdida/fotos';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => mockPathname,
}));

const DRAFT_KEY = 'reunipet:borrador-reporte';

interface Caso {
  tipo: 'PERDIDA' | 'ENCONTRADA';
  ruta1: string;
  titulo: string;
}

const CASOS: Caso[] = [
  {
    tipo: 'PERDIDA',
    ruta1: '/reportar/perdida',
    titulo: 'Reportar Mascota Perdida',
  },
  {
    tipo: 'ENCONTRADA',
    ruta1: '/reportar/encontrada',
    titulo: 'Reportar Mascota Encontrada',
  },
];

/** Caso activo: lo fija el beforeEach del describe parametrizado. */
let caso: Caso = CASOS[0];

function guardarBorradorEnMemoria(tipo: string = caso.tipo): void {
  window.sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      tipo,
      especie: 'perro',
      raza: 'labrador',
      color: 'negro',
      caracteristicasDistintivas: 'collar rojo',
      ubicacion: 'Parque Central',
      latitud: 10.42,
      longitud: -66.9,
    }),
  );
}

function leerDraft(): Record<string, unknown> | null {
  const crudo = window.sessionStorage.getItem(DRAFT_KEY);
  return crudo ? (JSON.parse(crudo) as Record<string, unknown>) : null;
}

/** Caso 2: el reporte ya se creó en un intento anterior. */
function guardarBorradorConReporte(tipo: string = caso.tipo): void {
  guardarBorradorEnMemoria(tipo);
  const actual = leerDraft() ?? {};
  window.sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({ ...actual, reporteId: 'rep-uno' }),
  );
}

type Json = Record<string, unknown> | unknown[];

function respuesta(ok: boolean, status: number, body: Json) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

function nuevaFoto() {
  secuenciaFoto += 1;
  return {
    id: `fot-${secuenciaFoto}`,
    reporteId: 'rep-uno',
    url: `/uploads/fot-${secuenciaFoto}.png`,
    orden: secuenciaFoto - 1,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

/** Flags por test para decidir qué responde cada endpoint. */
let crearOk = true;
let fotosOk = true;
/** Nombres de archivo que el backend rechaza (para simular fallo parcial). */
let fotosFallidas: string[] = [];

/** Ids únicos por subida para que las claves React no se dupliquen. */
let secuenciaFoto = 0;

function mockFetch(): jest.Mock {
  const fn = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/reportes')) {
        return crearOk
          ? respuesta(true, 201, {
              id: 'rep-uno',
              tipo: caso.tipo,
              estado: caso.tipo,
            })
          : respuesta(false, 500, { message: 'Error interno' });
      }
      if (url.includes('/fotos')) {
        // Fallo parcial: se rechaza solo el archivo listado en fotosFallidas.
        const formData = init?.body as FormData | undefined;
        const archivo = formData?.get('fotos');
        const nombre =
          archivo && typeof archivo === 'object' && 'name' in archivo
            ? String((archivo as File).name)
            : '';
        if (fotosFallidas.includes(nombre)) {
          return respuesta(false, 400, { message: 'Archivo inválido' });
        }
        return fotosOk
          ? respuesta(true, 201, [nuevaFoto()])
          : respuesta(false, 400, { message: 'Archivo inválido' });
      }
      throw new Error(`URL inesperada en el test: ${url}`);
    },
  ) as unknown as jest.Mock;
  global.fetch = fn;
  return fn;
}

function agregarFoto(nombre = 'mascota.png'): void {
  const input = screen.getByTestId('input-fotos');
  const file = new File(['contenido'], nombre, { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  caso = CASOS[0];
  mockPathname = '/reportar/perdida/fotos';
  window.sessionStorage.clear();
  crearOk = true;
  fotosOk = true;
  fotosFallidas = [];
  secuenciaFoto = 0;
  URL.createObjectURL = jest.fn(() => 'blob:mock');
  URL.revokeObjectURL = jest.fn();
  mockFetch();
});

describe.each(CASOS)(
  'FotosCarga (paso 2 de 2 — $tipo)',
  ({ tipo, ruta1, titulo }) => {
    beforeEach(() => {
      caso = { tipo, ruta1, titulo };
      mockPathname = `${ruta1}/fotos`;
    });

    it('muestra el título de su tipo', async () => {
      guardarBorradorEnMemoria();
      render(<FotosCarga />);

      expect(
        await screen.findByRole('heading', { name: titulo }),
      ).toBeInTheDocument();
    });

    it('entrar directo al paso 2 sin datos del paso 1 redirige a SU paso 1', async () => {
      render(<FotosCarga />);

      expect(await screen.findByTestId('cargando-borrador')).toBeInTheDocument();
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(ruta1);
      });
      // No hay nada que publicar: no se ofrece el botón ni se llama a la API.
      expect(screen.queryByTestId('publicar-reporte')).not.toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('Volver regresa a SU paso 1 conservando los datos del borrador', async () => {
      guardarBorradorEnMemoria();
      render(<FotosCarga />);

      fireEvent.click(await screen.findByTestId('volver-paso-1'));

      expect(push).toHaveBeenCalledWith(ruta1);
      // No se crea nada y el borrador sigue intacto para el paso 1.
      expect(global.fetch).not.toHaveBeenCalled();
      expect(leerDraft()?.especie).toBe('perro');
      expect(leerDraft()?.color).toBe('negro');
    });

    it('publicar sin fotos crea solo el reporte de SU tipo y redirige a su detalle', async () => {
      guardarBorradorEnMemoria();
      render(<FotosCarga />);

      fireEvent.click(await screen.findByTestId('publicar-reporte'));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/reportes/rep-uno');
      });

      // Un único POST /reportes y ninguno a /fotos.
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(String(url)).toContain('/reportes');
      expect((init as RequestInit).method).toBe('POST');
      const body = JSON.parse(String((init as RequestInit).body)) as Record<
        string,
        unknown
      >;
      expect(body.tipo).toBe(tipo);
      expect(body.especie).toBe('perro');
      expect(body.latitud).toBe(10.42);

      // Éxito: borrador limpio.
      expect(leerDraft()).toBeNull();
    });

    it('caso 2: con reporteId no aparece "Volver" y "Omitir fotos" limpia el borrador', async () => {
      guardarBorradorConReporte();
      render(<FotosCarga />);

      await screen.findByTestId('publicar-reporte');
      // Sin "Volver" (editar un reporte es HU17): la salida es el detalle.
      expect(screen.queryByTestId('volver-paso-1')).not.toBeInTheDocument();
      expect(
        screen.getByTestId('omitar-fotos'),
      ).toHaveTextContent('Omitir fotos y ver mi reporte');

      fireEvent.click(screen.getByTestId('omitar-fotos'));

      expect(push).toHaveBeenCalledWith('/reportes/rep-uno');
      // El borrador se limpia y NUNCA se crea un segundo reporte.
      expect(leerDraft()).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('caso 2: publicar con reporteId existente no crea un segundo reporte', async () => {
      guardarBorradorConReporte();
      render(<FotosCarga />);

      await screen.findByTestId('publicar-reporte');
      agregarFoto();
      fireEvent.click(screen.getByTestId('publicar-reporte'));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith('/reportes/rep-uno');
      });

      // Solo la subida de la foto: ni un POST /reportes nuevo.
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
        '/reportes/rep-uno/fotos',
      );
      expect(leerDraft()).toBeNull();
    });
  },
);

describe('FotosCarga (HU1/HU2 — casos completos)', () => {
  it('publicar con fotos sube el reporte y luego cada fotografía', async () => {
    guardarBorradorEnMemoria();
    render(<FotosCarga />);

    await screen.findByTestId('publicar-reporte');
    agregarFoto();
    expect(screen.getByTestId('thumb-pending')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('publicar-reporte'));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/reportes/rep-uno');
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(String(calls[0][0])).toContain('/reportes');
    expect(String(calls[1][0])).toContain('/reportes/rep-uno/fotos');
    // La subida va como FormData (sin Content-Type JSON forzado).
    expect((calls[1][1] as RequestInit).body).toBeInstanceOf(FormData);
    // La foto ya guardada aparece y el borrador se limpia.
    expect(screen.getByTestId('thumb-guardada')).toBeInTheDocument();
    expect(leerDraft()).toBeNull();
  });

  it('un fallo al subir una foto no pierde el reporte y permite reintentar', async () => {
    guardarBorradorEnMemoria();
    fotosOk = false;
    render(<FotosCarga />);

    await screen.findByTestId('publicar-reporte');
    agregarFoto('mala.png');
    fireEvent.click(screen.getByTestId('publicar-reporte'));

    // Avisa que el reporte SÍ está publicado y qué foto falló.
    expect(
      await screen.findByText(/El reporte está publicado, pero 1 foto/),
    ).toBeInTheDocument();
    expect(screen.getByText(/mala\.png/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    // El reporte creado queda registrado en el borrador (evita duplicados).
    expect(leerDraft()?.reporteId).toBe('rep-uno');
    // La foto fallida sigue en pantalla, lista para reintentar.
    expect(screen.getByTestId('thumb-pending')).toBeInTheDocument();

    // Reintento: solo se reenvía la foto, sin crear otro reporte.
    fotosOk = true;
    (global.fetch as jest.Mock).mockClear();
    fireEvent.click(screen.getByTestId('publicar-reporte'));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/reportes/rep-uno');
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      '/fotos',
    );
    expect(leerDraft()).toBeNull();
  });

  it('reintento tras fallo parcial: sube SOLO la foto que falló (no duplica las subidas)', async () => {
    guardarBorradorEnMemoria();
    fotosFallidas = ['mala.png'];
    render(<FotosCarga />);

    await screen.findByTestId('publicar-reporte');
    agregarFoto('buena-1.png');
    agregarFoto('mala.png');
    agregarFoto('buena-2.png');
    expect(screen.getAllByTestId('thumb-pending')).toHaveLength(3);

    fireEvent.click(screen.getByTestId('publicar-reporte'));

    // 1 POST /reportes + 3 POST /fotos (una por archivo).
    await screen.findByText(/El reporte está publicado, pero 1 foto/);
    expect(global.fetch).toHaveBeenCalledTimes(4);

    // Estado tras el fallo: 2 guardadas, SOLO la fallida sigue pendiente.
    expect(screen.getAllByTestId('thumb-guardada')).toHaveLength(2);
    expect(screen.getAllByTestId('thumb-pending')).toHaveLength(1);
    expect(screen.getByText(/mala\.png/)).toBeInTheDocument(); // cuál falló

    // Reintento: sin crear otro reporte y subiendo únicamente la fallida.
    fotosFallidas = []; // esta vez el backend acepta el archivo
    (global.fetch as jest.Mock).mockClear();
    fireEvent.click(screen.getByTestId('publicar-reporte'));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/reportes/rep-uno');
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/reportes/rep-uno/fotos');
    const formData = (init as RequestInit).body as FormData;
    const nombres = formData.getAll('fotos').map((f) => (f as File).name);
    expect(nombres).toEqual(['mala.png']); // solo la fallida
    expect(leerDraft()).toBeNull();
  });

  it('si la creación del reporte falla se queda en el paso 2 con el error, sin perder datos ni fotos', async () => {
    guardarBorradorEnMemoria();
    crearOk = false;
    render(<FotosCarga />);

    await screen.findByTestId('publicar-reporte');
    agregarFoto();
    fireEvent.click(screen.getByTestId('publicar-reporte'));

    // Se queda en el paso 2 con el error (mensaje del servidor, si lo hay).
    expect(await screen.findByTestId('error-text')).toHaveTextContent(
      'Error interno',
    );
    expect(push).not.toHaveBeenCalled();
    // Ni el borrador ni la foto seleccionada se pierden.
    expect(leerDraft()?.especie).toBe('perro');
    expect(leerDraft()?.reporteId).toBeUndefined();
    expect(screen.getByTestId('thumb-pending')).toBeInTheDocument();
    // El botón vuelve a habilitarse (no quedó trabado en "Publicando...").
    expect(screen.getByTestId('publicar-reporte')).toBeEnabled();
  });

  it('deshabilita el botón mientras publica (evita doble envío)', async () => {
    guardarBorradorEnMemoria();
    // Holder: la asignación ocurre dentro del callback, fuera del flujo que
    // controla el type checker.
    const pendiente: { liberar?: (r: unknown) => void } = {};
    global.fetch = jest.fn(
      () =>
        new Promise((res) => {
          pendiente.liberar = res;
        }),
    ) as unknown as typeof fetch;
    render(<FotosCarga />);

    fireEvent.click(await screen.findByTestId('publicar-reporte'));

    const boton = screen.getByTestId('publicar-reporte');
    expect(boton).toBeDisabled();
    expect(boton).toHaveTextContent('Publicando...');

    pendiente.liberar?.(respuesta(true, 201, {
      id: 'rep-uno',
      tipo: caso.tipo,
      estado: caso.tipo,
    }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/reportes/rep-uno');
    });
  });

  it('un borrador de OTRO tipo te lleva a su paso 2 (no publica en la ruta equivocada)', async () => {
    guardarBorradorEnMemoria('ENCONTRADA'); // pathname sigue en /perdida/fotos
    render(<FotosCarga />);

    await screen.findByTestId('publicar-reporte');
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/reportar/encontrada/fotos');
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('HU2: sin fotos muestra la ilustración propia y el consejo aprobado', async () => {
    guardarBorradorEnMemoria();
    render(<FotosCarga />);

    await screen.findByTestId('publicar-reporte');

    // Sin fotos: ilustración SVG propia (nada de imágenes de terceros).
    expect(
      screen.getByTestId('vista-previa-ilustracion'),
    ).toBeInTheDocument();
    expect(screen.queryByAltText(/Vista previa de la foto en las alertas/)).not.toBeInTheDocument();

    // Texto exacto del consejo (sin cifras ni promesas sobre IA/escaneo).
    expect(screen.getByText('Fotos de Alta Calidad')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Las fotos nítidas, con buena luz y que muestren el rostro y las marcas particulares ayudan a otras personas a reconocer a tu mascota\./,
      ),
    ).toBeInTheDocument();
    // Sin cifras inventadas ni promesas sobre IA/escaneo en el consejo.
    const tip = screen.getByTestId('tip-card');
    expect(tip).not.toHaveTextContent(/\d+%|IA|escaneo/i);
  });

  it('HU2: la vista previa muestra la foto seleccionada y luego la guardada', async () => {
    guardarBorradorEnMemoria();
    render(<FotosCarga />);

    await screen.findByTestId('publicar-reporte');
    // Pendiente: la ilustración se sustituye por la foto elegida.
    agregarFoto();
    const imgPendiente = screen.getByAltText(
      'Vista previa de la foto en las alertas',
    );
    expect(imgPendiente).toHaveAttribute('src', 'blob:mock');
    expect(
      screen.queryByTestId('vista-previa-ilustracion'),
    ).not.toBeInTheDocument();

    // Publicada: pasa a mostrarse la foto ya guardada en el servidor.
    fireEvent.click(screen.getByTestId('publicar-reporte'));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/reportes/rep-uno');
    });
    expect(
      screen.getByAltText('Vista previa de la foto en las alertas'),
    ).toHaveAttribute('src', '/uploads/fot-1.png');
  });
});
