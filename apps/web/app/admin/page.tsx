import type { Metadata } from 'next';
import { AdminPanel } from '@/components/admin/AdminPanel';

export const metadata: Metadata = {
  title: 'Administración · ReuniPet',
};

// HU18/HU19: gestionar reportes (ocultar/restaurar) y usuarios (suspender/reactivar).
export default function AdminPage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-text">Administración</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Oculta reportes con información incorrecta, duplicada o inapropiada y
        suspende las cuentas que hagan mal uso de la plataforma. Nada se
        borra: puedes restaurar y reactivar.
      </p>
      <AdminPanel />
    </div>
  );
}
