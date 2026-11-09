'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReporteResponse, UpdateReporteInput } from '@reunipet/shared';
import { ErrorText } from '@/components/ErrorText';
import { FormField } from '@/components/FormField';
import { EspecieSelector } from '@/components/reportes/EspecieSelector';
import {
  MapaSelector,
  type PuntoMapa,
} from '@/components/reportes/MapaSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TipCard } from '@/components/ui/TipCard';
import {
  ApiError,
  actualizarReporte,
  actualizarUbicacion,
  extractFieldErrors,
  getReporte,
} from '@/lib/api';

export const MENSAJE_SIN_PERMISO =
  'No puedes editar este reporte: solo su propietario puede hacerlo.';
export const MENSAJE_SIN_CAMBIOS = 'No hay cambios para guardar.';
const MENSAJE_ERROR = 'No se pudieron guardar los cambios. Intenta de nuevo.';

const ESPECIES = ['perro', 'gato', 'otro'];

interface FormState {
  especie: string;
  raza: string;
  color: string;
  caracteristicasDistintivas: string;
  ubicacion: string;
}

type Errores = Partial<Record<keyof FormState, string>>;

/** La especie guardada como "Perro" se muestra con la opción "perro". */
function especieDelSelector(especie: string): string {
  const minuscula = especie.trim().toLowerCase();
  return ESPECIES.includes(minuscula) ? minuscula : especie;
}

function formDesde(reporte: ReporteResponse): FormState {
  return {
    especie: especieDelSelector(reporte.especie),
    raza: reporte.raza ?? '',
    color: reporte.color,
    caracteristicasDistintivas: reporte.caracteristicasDistintivas,
    ubicacion: reporte.ubicacion ?? '',
  };
}

function puntoDesde(reporte: ReporteResponse): PuntoMapa | null {
  return reporte.latitud !== null && reporte.longitud !== null
    ? { lat: reporte.latitud, lng: reporte.longitud }
    : null;
}

function validar(form: FormState): Errores {
  const errores: Errores = {};
  if (!form.especie.trim()) errores.especie = 'La especie es obligatoria';
  if (!form.color.trim()) errores.color = 'El color es obligatorio';
  if (!form.caracteristicasDistintivas.trim()) {
    errores.caracteristicasDistintivas =
      'Las características distintivas son obligatorias';
  }
  return errores;
}

/** HU17: solo los campos que cambiaron respecto a lo guardado. */
function camposCambiados(
  form: FormState,
  original: FormState,
): UpdateReporteInput {
  const cambios: UpdateReporteInput = {};
  if (form.especie.trim() !== original.especie.trim()) {
    cambios.especie = form.especie.trim();
  }
  if (form.raza.trim() !== original.raza.trim()) {
    cambios.raza = form.raza.trim() || null;
  }
  if (form.color.trim() !== original.color.trim()) {
    cambios.color = form.color.trim();
  }
  if (
    form.caracteristicasDistintivas.trim() !==
    original.caracteristicasDistintivas.trim()
  ) {
    cambios.caracteristicasDistintivas = form.caracteristicasDistintivas.trim();
  }
  return cambios;
}

interface EditarReporteProps {
  id: string;
}

export function EditarReporte({ id }: EditarReporteProps): React.JSX.Element {
  const router = useRouter();
  const [estadoCarga, setEstadoCarga] = React.useState<
    'cargando' | 'listo' | 'no-encontrado' | 'sin-permiso' | 'error'
  >('cargando');
  const [original, setOriginal] = React.useState<FormState | null>(null);
  const [puntoOriginal, setPuntoOriginal] = React.useState<PuntoMapa | null>(
    null,
  );
  const [form, setForm] = React.useState<FormState | null>(null);
  const [punto, setPunto] = React.useState<PuntoMapa | null>(null);
  const [errores, setErrores] = React.useState<Errores>({});
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const reporte = await getReporte(id);
        if (cancelado) return;
        if (!reporte.esPropietario) {
          setEstadoCarga('sin-permiso');
          return;
        }
        const inicial = formDesde(reporte);
        setOriginal(inicial);
        setForm(inicial);
        setPuntoOriginal(puntoDesde(reporte));
        setPunto(puntoDesde(reporte));
        setEstadoCarga('listo');
      } catch (err) {
        if (cancelado) return;
        setEstadoCarga(
          err instanceof ApiError && err.status === 404
            ? 'no-encontrado'
            : 'error',
        );
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  function actualizar(campo: keyof FormState, valor: string): void {
    setForm((prev) => (prev ? { ...prev, [campo]: valor } : prev));
    setAviso(null);
    setErrores((prev) => {
      if (!prev[campo]) return prev;
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!form || !original) return;

    const erroresCliente = validar(form);
    const cambios = camposCambiados(form, original);
    const ubicacionCambio =
      punto?.lat !== puntoOriginal?.lat ||
      punto?.lng !== puntoOriginal?.lng ||
      form.ubicacion.trim() !== original.ubicacion.trim();
    // PATCH /ubicacion exige el punto: sin él no se puede guardar el texto.
    if (ubicacionCambio && !punto) {
      erroresCliente.ubicacion =
        'Marca un punto en el mapa para guardar la ubicación';
    }
    setErrores(erroresCliente);
    if (Object.keys(erroresCliente).length > 0) return;

    if (Object.keys(cambios).length === 0 && !ubicacionCambio) {
      setAviso(MENSAJE_SIN_CAMBIOS);
      return;
    }

    setGuardando(true);
    setAviso(null);
    try {
      if (Object.keys(cambios).length > 0) {
        await actualizarReporte(id, cambios);
        // Si después falla la ubicación, reintentar no reenvía estos campos.
        setOriginal({ ...original, ...form });
      }
      if (ubicacionCambio && punto) {
        await actualizarUbicacion(id, {
          latitud: punto.lat,
          longitud: punto.lng,
          ...(form.ubicacion.trim() ? { ubicacion: form.ubicacion.trim() } : {}),
        });
      }
      // El detalle vuelve a consultar el reporte al montarse: se ve el cambio
      // sin recargar la página.
      router.push(`/reportes/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setAviso(MENSAJE_SIN_PERMISO);
      } else if (err instanceof ApiError && err.status === 400) {
        const campos = extractFieldErrors(err);
        setErrores(campos);
        if (Object.keys(campos).length === 0) setAviso(MENSAJE_ERROR);
      } else {
        setAviso(MENSAJE_ERROR);
      }
      setGuardando(false);
    }
  }

  if (estadoCarga === 'cargando') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center text-muted">
        Cargando reporte...
      </div>
    );
  }

  if (estadoCarga !== 'listo' || !form) {
    const texto =
      estadoCarga === 'sin-permiso'
        ? MENSAJE_SIN_PERMISO
        : estadoCarga === 'no-encontrado'
          ? 'Reporte no encontrado.'
          : 'No se pudo cargar el reporte.';
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <p
          role="alert"
          className="text-sm font-medium text-destructive"
          data-testid="editar-bloqueado"
        >
          {texto}
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href={estadoCarga === 'no-encontrado' ? '/' : `/reportes/${id}`}>
            Volver
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <h1 className="text-2xl font-bold text-text">Editar reporte</h1>
          <p className="mt-1 text-sm text-muted">
            Actualiza los datos de tu reporte. El tipo y el estado no se
            cambian desde aquí.
          </p>

          <form
            className="mt-6 flex flex-col gap-4 rounded-card border border-border bg-card p-6 shadow-card"
            onSubmit={(e) => void guardar(e)}
            noValidate
            data-testid="editar-form"
          >
            <EspecieSelector
              value={form.especie}
              onChange={(valor) => actualizar('especie', valor)}
              error={errores.especie}
            />

            <FormField htmlFor="raza" label="Raza (opcional)" error={errores.raza}>
              <Input
                id="raza"
                name="raza"
                value={form.raza}
                onChange={(e) => actualizar('raza', e.target.value)}
              />
            </FormField>

            <FormField htmlFor="color" label="Color" error={errores.color}>
              <Input
                id="color"
                name="color"
                value={form.color}
                onChange={(e) => actualizar('color', e.target.value)}
                aria-invalid={errores.color ? true : undefined}
                aria-describedby={errores.color ? 'color-error' : undefined}
              />
            </FormField>

            <FormField
              htmlFor="caracteristicasDistintivas"
              label="Características distintivas"
              error={errores.caracteristicasDistintivas}
            >
              <Textarea
                id="caracteristicasDistintivas"
                name="caracteristicasDistintivas"
                value={form.caracteristicasDistintivas}
                onChange={(e) =>
                  actualizar('caracteristicasDistintivas', e.target.value)
                }
                aria-invalid={
                  errores.caracteristicasDistintivas ? true : undefined
                }
                aria-describedby={
                  errores.caracteristicasDistintivas
                    ? 'caracteristicasDistintivas-error'
                    : undefined
                }
              />
            </FormField>

            <FormField
              htmlFor="ubicacion"
              label="Ubicación de referencia (opcional)"
              error={errores.ubicacion}
            >
              <Input
                id="ubicacion"
                name="ubicacion"
                placeholder="Ej: cerca del parque Bolívar, avenida principal"
                value={form.ubicacion}
                onChange={(e) => actualizar('ubicacion', e.target.value)}
                aria-invalid={errores.ubicacion ? true : undefined}
                aria-describedby={
                  errores.ubicacion ? 'ubicacion-error' : undefined
                }
              />
            </FormField>

            {aviso && (
              <ErrorText id="editar-aviso">{aviso}</ErrorText>
            )}

            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link href={`/reportes/${id}`}>Cancelar</Link>
              </Button>
            </div>
          </form>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-card border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-semibold text-text">Ubicación en el mapa</p>
            <MapaSelector
              value={punto}
              onChange={(nuevo) => {
                setPunto(nuevo);
                setAviso(null);
                setErrores((prev) => {
                  if (!prev.ubicacion) return prev;
                  const next = { ...prev };
                  delete next.ubicacion;
                  return next;
                });
              }}
            />
          </div>
          <TipCard titulo="Coincidencias">
            Si cambias la especie, la raza o el color, volvemos a buscar
            coincidencias para tu reporte. Las alertas que ya revisaste se
            conservan.
          </TipCard>
        </aside>
      </div>
    </div>
  );
}
