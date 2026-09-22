import * as React from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TipCardProps {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}

export function TipCard({
  titulo,
  children,
  className,
}: TipCardProps): React.JSX.Element {
  return (
    <aside
      className={cn(
        'flex gap-3 rounded-card bg-info-bg p-4 text-left',
        className,
      )}
      data-testid="tip-card"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
        <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{titulo}</p>
        <div className="mt-1 text-sm leading-relaxed text-muted">
          {children}
        </div>
      </div>
    </aside>
  );
}
