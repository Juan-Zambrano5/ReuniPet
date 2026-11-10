'use client';

import * as React from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FotoReporteProps {
  src: string;
  alt: string;
  className?: string;
  /** Miniatura: el recuadro de respaldo muestra solo el icono. */
  compacta?: boolean;
  'data-testid'?: string;
}

/**
 * Foto de un reporte. Si el archivo no carga (404, borrado del disco), muestra
 * un recuadro "Foto no disponible" en lugar del icono de imagen rota.
 */
export function FotoReporte({
  src,
  alt,
  className,
  compacta = false,
  'data-testid': testId,
}: FotoReporteProps): React.JSX.Element {
  // Se guarda qué src falló: al cambiar de foto (galería) se vuelve a intentar.
  const [srcFallido, setSrcFallido] = React.useState<string | null>(null);

  if (srcFallido === src) {
    return (
      <div
        role="img"
        aria-label={alt ? `${alt}: foto no disponible` : 'Foto no disponible'}
        className={cn(
          className,
          'flex w-full flex-col items-center justify-center gap-1 bg-surface text-muted',
          !compacta && 'min-h-40 px-4 text-center text-xs',
        )}
        data-testid={testId}
      >
        <ImageOff className={compacta ? 'h-4 w-4' : 'h-6 w-6'} aria-hidden />
        {!compacta && <span aria-hidden>Foto no disponible</span>}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      data-testid={testId}
      onError={() => setSrcFallido(src)}
    />
  );
}
