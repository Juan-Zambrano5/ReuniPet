import { cn } from '@/lib/utils';

interface AlertCardProps {
  mensaje: string;
  tiempo: string;
  descripcionReporte: string;
  onVer: () => void;
  onDescartar: () => void;
  descartando?: boolean;
  id?: string;
}

export function AlertCard({
  mensaje,
  tiempo,
  descripcionReporte,
  onVer,
  onDescartar,
  descartando,
  id,
}: AlertCardProps): React.JSX.Element {
  return (
    <article
      className="flex flex-col gap-3 rounded bg-primary-soft p-4"
      data-testid={id ? `alerta-${id}` : 'alerta-card'}
    >
      <div>
        <p className="font-medium text-text">{mensaje}</p>
        <p className="mt-1 text-sm text-muted">{descripcionReporte}</p>
        <p className="mt-2 text-xs text-muted">{tiempo}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onVer}
          className={cn(
            'inline-flex h-10 flex-1 items-center justify-center rounded bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover',
          )}
        >
          Ver coincidencia
        </button>
        <button
          type="button"
          onClick={onDescartar}
          disabled={descartando}
          className={cn(
            'inline-flex h-10 flex-1 items-center justify-center rounded bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-[#E4E4E7]',
            descartando && 'opacity-60',
          )}
        >
          {descartando ? 'Descartando...' : 'Descartar'}
        </button>
      </div>
    </article>
  );
}
