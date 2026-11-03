import { EstadoReporte } from '@reunipet/shared';
import { cn } from '@/lib/utils';

export type StatusBadgeVariant = 'success' | 'danger' | 'neutral' | 'indigo';

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  success: 'bg-success-bg text-success',
  danger: 'bg-red-50 text-danger',
  neutral: 'bg-surface text-muted',
  // SPRINT3_PLAN §4.3: RECUPERADA en índigo suave (contraste AA ~7:1).
  indigo: 'bg-indigo-50 text-indigo-700',
};

export function StatusBadge({
  variant,
  children,
  className,
}: StatusBadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold',
        VARIANT_CLASSES[variant],
        className,
      )}
      data-testid="status-badge"
    >
      {children}
    </span>
  );
}

// Texto y variante del badge según el estado del reporte (detalle y mis reportes).
export const BADGE_ESTADO: Record<
  EstadoReporte,
  { variante: StatusBadgeVariant; texto: string }
> = {
  [EstadoReporte.PERDIDA]: { variante: 'danger', texto: 'PERDIDO' },
  [EstadoReporte.ENCONTRADA]: { variante: 'success', texto: 'ENCONTRADO' },
  [EstadoReporte.RECUPERADA]: { variante: 'indigo', texto: 'RECUPERADO' },
};
