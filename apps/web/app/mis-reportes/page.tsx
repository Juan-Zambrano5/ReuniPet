import type { Metadata } from 'next';
import { MisReportes } from '@/components/reportes/MisReportes';

export const metadata: Metadata = {
  title: 'Mis reportes · ReuniPet',
};

// HU15: seguimiento de los reportes propios hasta el reencuentro.
export default function MisReportesPage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-text">Mis reportes</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Consulta el estado de tus reportes y sus posibles coincidencias.
      </p>
      <MisReportes />
    </div>
  );
}
