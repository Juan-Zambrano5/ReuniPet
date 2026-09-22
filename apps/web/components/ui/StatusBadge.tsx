import { cn } from '@/lib/utils';

type StatusBadgeVariant = 'success' | 'danger' | 'neutral';

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  success: 'bg-success-bg text-success',
  danger: 'bg-red-50 text-danger',
  neutral: 'bg-surface text-muted',
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
