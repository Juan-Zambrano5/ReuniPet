'use client';

import * as React from 'react';
import { AdminReportes } from '@/components/admin/AdminReportes';
import { AdminUsuarios } from '@/components/admin/AdminUsuarios';
import { cn } from '@/lib/utils';

const PESTANAS = [
  { id: 'reportes', label: 'Reportes' },
  { id: 'usuarios', label: 'Usuarios' },
] as const;

type Pestana = (typeof PESTANAS)[number]['id'];

// HU18/HU19: pestañas de la administración (patrón tabs de WAI-ARIA).
export function AdminPanel(): React.JSX.Element {
  const [activa, setActiva] = React.useState<Pestana>('reportes');
  const refs = React.useRef<Record<Pestana, HTMLButtonElement | null>>({
    reportes: null,
    usuarios: null,
  });

  function teclado(e: React.KeyboardEvent): void {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = PESTANAS.findIndex((p) => p.id === activa);
    const siguiente =
      PESTANAS[(i + (e.key === 'ArrowRight' ? 1 : -1) + PESTANAS.length) % PESTANAS.length].id;
    setActiva(siguiente);
    refs.current[siguiente]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones de administración"
        className="mb-6 flex gap-1 border-b border-border"
        onKeyDown={teclado}
      >
        {PESTANAS.map((p) => {
          const seleccionada = activa === p.id;
          return (
            <button
              key={p.id}
              ref={(el) => {
                refs.current[p.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${p.id}`}
              aria-selected={seleccionada}
              aria-controls={`panel-${p.id}`}
              tabIndex={seleccionada ? 0 : -1}
              onClick={() => setActiva(p.id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                seleccionada
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text',
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${activa}`}
        aria-labelledby={`tab-${activa}`}
      >
        {activa === 'reportes' ? <AdminReportes /> : <AdminUsuarios />}
      </div>
    </div>
  );
}
