import type { Metadata } from 'next';
import { AdminReportes } from '@/components/admin/AdminReportes';

export const metadata: Metadata = {
  title: 'Administración · ReuniPet',
};

// HU18: gestionar los reportes publicados (ocultar y restaurar).
export default function AdminPage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-text">Administración</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Oculta los reportes con información incorrecta, duplicada o
        inapropiada. Un reporte oculto no se borra y puedes restaurarlo.
      </p>
      <AdminReportes />
    </div>
  );
}
