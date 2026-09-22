import { MapPinned } from 'lucide-react';

export default function MapaPage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-card bg-primary-soft">
        <MapPinned className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-text">Buscar en Mapa</h1>
      <p className="mt-2 text-muted" data-testid="mapa-proximamente">
        Disponible próximamente. Estamos preparando el mapa interactivo de
        reportes.
      </p>
    </div>
  );
}
