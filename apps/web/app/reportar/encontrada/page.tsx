import { MapPin } from 'lucide-react';
import { TipoReporte } from '@reunipet/shared';
import { ReporteForm } from '@/components/reportes/ReporteForm';
import { StatusBadge } from '@/components/ui/StatusBadge';

export const dynamic = 'force-dynamic';

export default function ReportarEncontradaPage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <StatusBadge variant="success">Reporte de Hallazgo</StatusBadge>
          <h1 className="mt-4 text-2xl font-bold text-text">
            Mascota Encontrada
          </h1>
          <p className="mt-1 text-sm text-muted">
            Registra la mascota que encontraste y su ubicación para avisar a su
            propietario.
          </p>
          <div className="mt-6">
            <ReporteForm tipo={TipoReporte.ENCONTRADA} />
          </div>
        </div>

        <aside>
          <div className="rounded-card border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-semibold text-text">
              Ubicación de Referencia
            </p>
            {/* TODO(Sprint2): reemplazar por mapa real al implementar HU9 (sin SDK por ahora) */}
            <div
              className="relative mt-3 h-48 overflow-hidden rounded-control border border-border bg-gradient-to-br from-[#E8F5EE] via-[#F8FAFC] to-[#E8EEFF]"
              role="img"
              aria-label="Mapa visual de referencia (mock)"
              data-testid="mapa-mock"
            >
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    'linear-gradient(#D7DEE8 1px, transparent 1px), linear-gradient(90deg, #D7DEE8 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
                aria-hidden
              />
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger text-white shadow-card">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <span className="mt-1 rounded-pill bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-text shadow-card">
                  Parque Central
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Mapa visual de referencia. El reporte envía la ubicación como
              texto; el mapa interactivo llega con HU9 (Sprint 2).
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
