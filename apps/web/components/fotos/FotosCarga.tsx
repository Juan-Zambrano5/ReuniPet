'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Camera, ImageIcon, PawPrint, Trash2 } from 'lucide-react';
import { ErrorText } from '@/components/ErrorText';
import { StepBadge } from '@/components/ui/StepBadge';
import { Button } from '@/components/ui/button';
import { ApiError, API_URL, getSessionHeaders, getReporte } from '@/lib/api';

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

export function FotosCarga(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reporteId = searchParams.get('id');

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [guardadas, setGuardadas] = React.useState<number | null>(null);
  const [pending, setPending] = React.useState<PendingFoto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [cargandoReporte, setCargandoReporte] = React.useState(true);
  const [publicando, setPublicando] = React.useState(false);
  const previewsRef = React.useRef<Map<string, string>>(new Map());

  React.useEffect(() => {
    const urls = previewsRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, []);

  React.useEffect(() => {
    if (!reporteId) {
      setCargandoReporte(false);
      setError('Falta el id del reporte. Vuelve al paso 1.');
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        const reporte = await getReporte(reporteId);
        if (!cancelado) setGuardadas(reporte.fotos?.length ?? 0);
      } catch {
        if (!cancelado) setGuardadas(0);
      } finally {
        if (!cancelado) setCargandoReporte(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [reporteId]);

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
      setPending((prev) => [...prev, ...nuevos]);
    }
  }

  function removePending(key: string): void {
    setPending((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        previewsRef.current.delete(key);
      }
      return prev.filter((p) => p.key !== key);
    });
  }

  async function handlePublicar(): Promise<void> {
    setError(null);
    if (!reporteId) {
      setError('Falta el id del reporte. Vuelve al paso 1.');
      return;
    }

    setPublicando(true);
    try {
      if (pending.length > 0) {
        const formData = new FormData();
        for (const { file } of pending) formData.append('fotos', file);
        const res = await fetch(`${API_URL}/reportes/${reporteId}/fotos`, {
          method: 'POST',
          headers: getSessionHeaders(),
          body: formData,
        });
        if (!res.ok) {
          const body: unknown = await res.json().catch(() => ({}));
          throw new ApiError(res.status, body);
        }
        for (const p of pending) {
          URL.revokeObjectURL(p.previewUrl);
          previewsRef.current.delete(p.key);
        }
        setPending([]);
      }
      router.push('/');
    } catch (err) {
      // RNF-05: el reporte y las fotos ya guardadas no se pierden
      if (err instanceof ApiError) {
        const body = err.body as { message?: string | string[] } | undefined;
        setError(
          Array.isArray(body?.message)
            ? body.message.join(', ')
            : (body?.message ??
              'No se pudieron guardar las fotografías. El reporte se mantiene publicado.'),
        );
      } else {
        setError(
          'Error de conexión. Tus fotos seleccionadas se conservan y el reporte no se pierde.',
        );
      }
    } finally {
      setPublicando(false);
    }
  }

  const totalFotos = (guardadas ?? 0) + pending.length;

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
            Reportar Mascota Perdida
          </h1>

          <div className="mt-6 rounded-card border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-semibold text-text" data-testid="fotos-count">
              Fotos cargadas ({totalFotos})
            </p>
            <p className="mt-1 text-xs text-muted">
              Formatos: JPG, PNG o WEBP — máximo 5MB cada una.
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

            {cargandoReporte && (
              <p className="mt-4 text-sm text-muted">Cargando reporte...</p>
            )}

            {totalFotos > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {(guardadas ?? 0) > 0 &&
                  Array.from({ length: guardadas ?? 0 }).map((_, i) => (
                    <div
                      key={`guardada-${i}`}
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-card border border-border bg-success-bg-soft text-center"
                      data-testid="thumb-guardada"
                    >
                      <ImageIcon className="h-5 w-5 text-success" aria-hidden />
                      <span className="text-[10px] font-medium text-success">
                        Guardada
                      </span>
                    </div>
                  ))}
                {pending.map((p) => (
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
              <Button
                type="button"
                variant="secondary"
                className="sm:flex-1"
                onClick={() => router.push(pathname.replace(/\/fotos$/, ''))}
                disabled={publicando}
              >
                Volver
              </Button>
              <Button
                type="button"
                className="sm:flex-1"
                onClick={handlePublicar}
                disabled={publicando}
                data-testid="publicar-reporte"
              >
                {publicando ? 'Publicando...' : 'Publicar reporte'}
              </Button>
            </div>
          </div>
        </div>

        <aside className="hidden md:block">
          <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-border bg-card p-8 text-center shadow-card">
            <span className="flex h-32 w-32 items-center justify-center rounded-full bg-primary-soft">
              <PawPrint className="h-16 w-16 text-primary" aria-hidden />
            </span>
            <p className="text-sm font-medium text-text">Foto de referencia</p>
            <p className="text-xs text-muted">
              Así se verán tus fotos en las alertas de coincidencia.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
