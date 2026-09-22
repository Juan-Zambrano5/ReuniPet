'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ErrorText } from '@/components/ErrorText';

const OPCIONES = ['perro', 'gato', 'otro'] as const;

interface EspecieSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function EspecieSelector({
  value,
  onChange,
  error,
}: EspecieSelectorProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5" data-testid="field-especie">
      <span className="text-sm font-medium leading-none">
        Especie <span className="text-destructive" aria-hidden>*</span>
      </span>
      <div
        role="radiogroup"
        aria-label="Especie"
        className="flex flex-wrap gap-2"
      >
        {OPCIONES.map((opcion) => {
          const seleccionada = value === opcion;
          return (
            <button
              key={opcion}
              type="button"
              role="radio"
              aria-checked={seleccionada}
              onClick={() => onChange(opcion)}
              className={cn(
                'rounded-pill border px-4 py-2 text-sm font-medium capitalize transition-colors',
                seleccionada
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white text-text hover:border-primary hover:text-primary',
              )}
            >
              {opcion}
            </button>
          );
        })}
      </div>
      {error && <ErrorText id="especie-error">{error}</ErrorText>}
    </div>
  );
}
