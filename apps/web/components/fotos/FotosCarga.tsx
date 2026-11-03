'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Camera, ImageIcon, Trash2 } from 'lucide-react';
import { FotografiaResponse, TipoReporte } from '@reunipet/shared';
import { ErrorText } from '@/components/ErrorText';
import { StepBadge } from '@/components/ui/StepBadge';
import { TipCard } from '@/components/ui/TipCard';
import { Button } from '@/components/ui/button';
import {
  ApiError,
  createReporte,
  apiFetch,
} from '@/lib/api';
import {
  BorradorReporte,
  guardarBorrador,
  leerBorrador,
  limpiarBorrador,
  rutaPaso1,
  rutaPaso2,
} from '@/lib/borrador';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface PendingFoto {
  key: string;
  file: File;
  previewUrl: string;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'El archivo no es una imagen JPG, PNG o WEBP válida';
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'La imagen supera el máximo de 5MB';
  }
  return null;
}

function mensajeDeError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | undefined;
    if (Array.isArray(body?.message)) return body.message.join(', ');
    if (body?.message) return body.message;
    return 'el servidor rechazó la imagen';
  }
  return 'sin conexión con el servidor';
}

/**
 * Paso 2 de 2 del reporte de mascota perdida (HU1) o encontrada (HU3).
 *
 * Aquí se crea el reporte por primera vez: "Publicar reporte" hace
 * POST /reportes con los datos del borrador del paso 1 y, solo si la
 * creación sale bien, sube las fotos (opcionales) de una en una. Cualquier
 * fallo conserva lo escrito y las fotos seleccionadas.
 */
export function FotosCarga(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  // La ruta decide el tipo: /reportar/encontrada/fotos → ENCONTRADA.
  const tipo: TipoReporte = pathname?.includes('/encontrada')
    ? TipoReporte.ENCONTRADA
    : TipoReporte.PERDIDA;
  const ruta1 = rutaPaso1(tipo);
  const esEncontrada = tipo === TipoReporte.ENCONTRADA;

  const inputRef = React.useRef<HTMLInputElement>(null);
  const iniciadoRef = React.useRef(false);

  // null = todavía no se leyó el borrador (o no existe).
  const [borrador, setBorrador] = React.useState<BorradorReporte | null>(null);
  const [guardadas, setGuardadas] = React.useState<FotografiaResponse[]>([]);
  const [pendientes, setPendientes] = React.useState<PendingFoto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [publicando, setPublicando] = React.useState(false);
  const previewsRef = React.useRef<Map<string, string>>(new Map());

  // Sin datos del paso 1 no hay nada que publicar: redirige al paso 1.
  // El ref garantiza que el efecto corre una sola vez aunque el mock de
  // router devuelva un objeto nuevo en cada render.
  React.useEffect(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;
    const datos = leerBorrador();
    if (!datos) {
      router.replace(ruta1);
      return;
    }
    setBorrador(datos);
    // El borrador manda: si es de otro tipo, se navega a su paso 2.
    if (datos.tipo !== tipo) {
      router.replace(rutaPaso2(datos.tipo));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  React.useEffect(() => {
    const urls = previewsRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, []);

  function handleFiles(fileList: FileList | null): void {
    if (!fileList) return;
    setError(null);
    const nuevos: PendingFoto[] = [];
    for (const file of Array.from(fileList)) {
      const fileError = validateFile(file);
      if (fileError) {
        setError(fileError);
        continue;
      }
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(file);
      previewsRef.current.set(key, previewUrl);
      nuevos.push({ key, file, previewUrl });
    }
    if (nuevos.length > 0) {
      setPendientes((prev) => [...prev, ...nuevos]);
    }
  }

  function removePending(key: string): void {
    setPendientes((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        previewsRef.current.delete(key);
      }
      return prev.filter((p) => p.key !== key);
    });
  }

  /** Sube una foto; solo se quita de pendientes si el servidor la aceptó. */
  async function subirFoto(
    reporteId: string,
    foto: PendingFoto,
  ): Promise<FotografiaResponse[]> {
    const formData = new FormData();
    formData.append('fotos', foto.file);
    // HU16: apiFetch agrega el token y maneja el 401 (sesión expirada).
    const res = await apiFetch(`/reportes/${reporteId}/fotos`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body);
    }
    return (await res.json()) as FotografiaResponse[];
  }

  async function handlePublicar(): Promise<void> {
    if (!borrador || publicando) return;
    setError(null);

    setPublicando(true);
    try {
      // 1) Crear el reporte solo si aún no existe (reintento tras un fallo
      //    de foto: el id queda en el borrador para no duplicar).
      let reporteId = borrador.reporteId;
      if (!reporteId) {
        const reporte = await createReporte({
          tipo: borrador.tipo,
          especie: borrador.especie.trim(),
          raza: borrador.raza.trim() || undefined,
          color: borrador.color.trim(),
          caracteristicasDistintivas: borrador.caracteristicasDistintivas.trim(),
          ubicacion: borrador.ubicacion.trim() || undefined,
          latitud: borrador.latitud,
          longitud: borrador.longitud,
        });
        reporteId = reporte.id;
        const actualizado = { ...borrador, reporteId };
        guardarBorrador(actualizado);
        setBorrador(actualizado);
      }

      // 2) Subir fotos de una en una: el backend aborta con la primera
      //    inválida, así un lote conjunto reintentaría fotos ya guardadas.
      if (pendientes.length > 0) {
        const fallidas: PendingFoto[] = [];
        const motivos: string[] = [];
        const subidas: FotografiaResponse[] = [];
        for (const foto of pendientes) {
          try {
            const creadas = await subirFoto(reporteId, foto);
            subidas.push(...creadas);
            URL.revokeObjectURL(foto.previewUrl);
            previewsRef.current.delete(foto.key);
          } catch (err) {
            fallidas.push(foto);
            motivos.push(`${foto.file.name} (${mensajeDeError(err)})`);
          }
        }
        if (subidas.length > 0) {
          setGuardadas((prev) => [...prev, ...subidas]);
        }
        if (fallidas.length > 0) {
          setPendientes(fallidas);
          setError(
            `El reporte está publicado, pero ${fallidas.length} foto(s) no se pudieron subir: ` +
              `${motivos.join('; ')}. Puedes reintentar sin duplicar el reporte.`,
          );
          return;
        }
      }

      // 3) Éxito completo: borrador limpio y al detalle del reporte.
      limpiarBorrador();
      router.push(`/reportes/${reporteId}`);
    } catch (err) {
      // RNF-05: la creación falló; el borrador y las fotos siguen intactos.
      if (err instanceof ApiError) {
        const body = err.body as { message?: string | string[] } | undefined;
        setError(
          Array.isArray(body?.message)
            ? body.message.join(', ')
            : (body?.message ??
              'No se pudo crear el reporte. Tus datos y fotos se conservan.'),
        );
      } else {
        setError(
          'Error de conexión con el servidor. Tus datos y fotos se conservan.',
        );
      }
    } finally {
      setPublicando(false);
    }
  }

  const totalFotos = guardadas.length + pendientes.length;
  const sinBorrador = borrador === null;
  // Caso 2 (HU1): el reporte ya fue creado en un intento anterior.
  const reporteYaCreado = Boolean(borrador?.reporteId);
  const reporteId = borrador?.reporteId ?? '';
  // HU2: la vista previa muestra la primera foto guardada; si aún no hay
  // ninguna, la primera pendiente; y sin fotos, una ilustración propia.
  const fotoVistaPrevia = guardadas[0]?.url ?? pendientes[0]?.previewUrl ?? null;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <StepBadge
            paso={2}
            total={2}
            descripcion="Agrega fotos de la mascota para mejorar las posibilidades de reencuentro"
          />
          <h1 className="mt-4 text-2xl font-bold text-text">
            {esEncontrada
              ? 'Reportar Mascota Encontrada'
              : 'Reportar Mascota Perdida'}
          </h1>

          <div className="mt-6 rounded-card border border-border bg-card p-6 shadow-card">
            {sinBorrador ? (
              <p className="text-sm text-muted" data-testid="cargando-borrador">
                Cargando...
              </p>
            ) : (
              <>
            <p
              className="text-sm font-semibold text-text"
              data-testid="fotos-count"
            >
              Fotos cargadas ({totalFotos})
            </p>
            <p className="mt-1 text-xs text-muted">
              Formatos: JPG, PNG o WEBP — máximo 5MB cada una. Las fotos son
              opcionales: puedes publicar solo con los datos del paso 1.
            </p>

            <button
              type="button"
              className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-[#C7C9D1] bg-surface px-4 py-10 text-center transition-colors hover:border-primary hover:bg-primary-soft"
              onClick={() => inputRef.current?.click()}
              disabled={publicando}
              data-testid="zona-carga"
            >
              <Camera className="h-8 w-8 text-muted" aria-hidden />
              <span className="text-sm font-medium text-muted">
                Subir más fotos
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              data-testid="input-fotos"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
              disabled={publicando}
            />

            {totalFotos > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {guardadas.map((foto) => (
                  <div
                    key={foto.id}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-card border border-border bg-success-bg-soft text-center"
                    data-testid="thumb-guardada"
                  >
                    <ImageIcon className="h-5 w-5 text-success" aria-hidden />
                    <span className="text-[10px] font-medium text-success">
                      Guardada
                    </span>
                  </div>
                ))}
                {pendientes.map((p) => (
                  <div
                    key={p.key}
                    className="relative aspect-square overflow-hidden rounded-card border border-border"
                    data-testid="thumb-pending"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt="Vista previa de foto pendiente"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Eliminar foto pendiente"
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1.5 text-danger shadow hover:bg-white"
                      onClick={() => removePending(p.key)}
                      disabled={publicando}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-4">
                <ErrorText id="fotos-error-global">{error}</ErrorText>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {reporteYaCreado ? (
                // Caso 2 (HU1): el reporte ya existe. No se vuelve al paso 1
                // (editar un reporte es HU17) ni se puede crear un segundo:
                // la salida es ver el reporte ya publicado.
                <Button
                  type="button"
                  variant="secondary"
                  className="sm:flex-1"
                  onClick={() => {
                    limpiarBorrador();
                    router.push(`/reportes/${reporteId}`);
                  }}
                  disabled={publicando}
                  data-testid="omitar-fotos"
                >
                  Omitir fotos y ver mi reporte
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  className="sm:flex-1"
                  onClick={() => router.push(ruta1)}
                  disabled={publicando}
                  data-testid="volver-paso-1"
                >
                  Volver
                </Button>
              )}
              <Button
                type="button"
                className="sm:flex-1"
                onClick={handlePublicar}
                disabled={publicando}
                data-testid="publicar-reporte"
              >
                {publicando
                  ? 'Publicando...'
                  : reporteYaCreado
                    ? 'Subir fotos'
                    : 'Publicar reporte'}
              </Button>
            </div>
              </>
            )}
          </div>
        </div>

        <aside className="hidden md:block">
          <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-border bg-card p-8 text-center shadow-card">
            <span
              className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-primary-soft"
              data-testid="vista-previa-foto"
            >
              {fotoVistaPrevia ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={fotoVistaPrevia}
                  alt="Vista previa de la foto en las alertas"
                  className="h-full w-full object-cover"
                />
              ) : (
                /* Ilustración propia (SVG, sin imágenes de terceros). */
                <svg
                  viewBox="0 0 64 64"
                  role="img"
                  aria-label="Ilustración de una pata: aún no hay fotos"
                  className="h-16 w-16 text-primary"
                  data-testid="vista-previa-ilustracion"
                >
                  <ellipse cx="32" cy="42" rx="13" ry="10" fill="currentColor" />
                  <circle cx="17" cy="27" r="6" fill="currentColor" />
                  <circle cx="27" cy="19" r="6" fill="currentColor" />
                  <circle cx="38" cy="19" r="6" fill="currentColor" />
                  <circle cx="48" cy="27" r="6" fill="currentColor" />
                </svg>
              )}
            </span>
            <p className="text-sm font-medium text-text">Foto de referencia</p>
            <p className="text-xs text-muted">
              Así se verá tu foto en las alertas de coincidencia.
            </p>
          </div>
          <TipCard titulo="Fotos de Alta Calidad" className="mt-4">
            Las fotos nítidas, con buena luz y que muestren el rostro y las
            marcas particulares ayudan a otras personas a reconocer a tu
            mascota.
          </TipCard>
        </aside>
      </div>
    </div>
  );
}
