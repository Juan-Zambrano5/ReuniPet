import { Suspense } from 'react';
import { FotosCarga } from '@/components/fotos/FotosCarga';

export const dynamic = 'force-dynamic';

export default function ReportarPerdidaFotosPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 text-center text-muted">
          Cargando...
        </div>
      }
    >
      <FotosCarga />
    </Suspense>
  );
}
