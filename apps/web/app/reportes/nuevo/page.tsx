import { Suspense } from 'react';
import { TipoReporte } from '@reunipet/shared';
import { ReporteForm } from '@/components/reportes/ReporteForm';

export const dynamic = 'force-dynamic';

async function NuevoReporte({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const tipo =
    params.tipo === 'encontrada' ? TipoReporte.ENCONTRADA : TipoReporte.PERDIDA;
  return <ReporteForm tipo={tipo} />;
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}): React.JSX.Element {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Cargando...</div>}>
      <NuevoReporte searchParams={searchParams} />
    </Suspense>
  );
}
