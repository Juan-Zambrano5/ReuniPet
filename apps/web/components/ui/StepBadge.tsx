interface StepBadgeProps {
  paso: number;
  total: number;
  descripcion?: string;
}

export function StepBadge({
  paso,
  total,
  descripcion,
}: StepBadgeProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5" data-testid="step-badge">
      <span className="inline-flex w-fit items-center rounded-pill bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
        Paso {paso} de {total}
      </span>
      {descripcion && (
        <span className="text-sm text-muted">{descripcion}</span>
      )}
    </div>
  );
}
