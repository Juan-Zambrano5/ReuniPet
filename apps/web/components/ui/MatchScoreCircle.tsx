import { cn } from '@/lib/utils';

interface MatchScoreCircleProps {
  porcentaje: number;
  className?: string;
}

export function MatchScoreCircle({
  porcentaje,
  className,
}: MatchScoreCircleProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex h-32 w-32 flex-col items-center justify-center rounded-full border-8 border-primary-soft bg-white',
        className,
      )}
      role="img"
      aria-label={`Coincidencia ${porcentaje}%`}
      data-testid="match-score-circle"
    >
      <span className="text-3xl font-bold text-primary">{porcentaje}%</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        coincidencia
      </span>
    </div>
  );
}
