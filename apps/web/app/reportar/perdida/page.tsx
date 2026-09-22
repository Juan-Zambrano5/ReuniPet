import { PawPrint } from 'lucide-react';
import { TipoReporte } from '@reunipet/shared';
import { ReporteForm } from '@/components/reportes/ReporteForm';
import { StepBadge } from '@/components/ui/StepBadge';
import { TipCard } from '@/components/ui/TipCard';

export const dynamic = 'force-dynamic';

export default function ReportarPerdidaPage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <StepBadge
            paso={1}
            total={2}
            descripcion="Completa los datos de tu mascota"
          />
          <h1 className="mt-4 text-2xl font-bold text-text">
            Reportar Mascota Perdida
          </h1>
          <p className="mt-1 text-sm text-muted">
            Cuéntanos cómo es tu mascota para que la comunidad pueda ayudarte
            a encontrarla.
          </p>
          <div className="mt-6">
            <ReporteForm tipo={TipoReporte.PERDIDA} />
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <TipCard titulo="Consejo útil">
            Usa fotos recientes y con buena luz. Incluye detalles como collar,
            manchas o cicatrices: el Comparador Inteligente las usa para
            proponer coincidencias.
          </TipCard>
          <div className="hidden flex-col items-center justify-center gap-3 rounded-card border border-border bg-card p-8 text-center shadow-card md:flex">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-soft">
              <PawPrint className="h-12 w-12 text-primary" aria-hidden />
            </span>
            <p className="text-sm font-medium text-text">Tu mascota te espera</p>
            <p className="text-xs text-muted">
              Publica su reporte en menos de 2 minutos.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
