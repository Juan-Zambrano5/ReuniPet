import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  MapPinned,
  PawPrint,
  PlusCircle,
  Search,
} from 'lucide-react';

const ACCIONES = [
  {
    href: '/reportar/perdida',
    titulo: 'Reportar mascota perdida',
    descripcion: 'Publica los datos de tu mascota en 2 pasos.',
    icono: PlusCircle,
  },
  {
    href: '/reportar/encontrada',
    titulo: 'Reportar mascota encontrada',
    descripcion: 'Avisa al propietario de un hallazgo.',
    icono: PawPrint,
  },
  {
    href: '/alertas',
    titulo: 'Ver alertas activas',
    descripcion: 'Revisa las coincidencias detectadas por el comparador.',
    icono: Bell,
  },
  {
    href: '/mapa',
    titulo: 'Buscar en el mapa',
    descripcion: 'Disponible próximamente.',
    icono: MapPinned,
  },
];

export default function HomePage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <section className="rounded-card border border-border bg-card p-8 shadow-card">
        <span className="inline-flex items-center rounded-pill bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          PETFINDER IA
        </span>
        <h1 className="mt-4 text-3xl font-bold text-text">
          ReuniPet — reporta, busca y reencuentra
        </h1>
        <p className="mt-2 text-muted">
          Plataforma de reporte y reencuentro de mascotas perdidas y
          encontradas. El Comparador Inteligente detecta posibles coincidencias
          y te avisa.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/reportar/perdida"
            className="inline-flex h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Reportar mascota perdida
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/reportar/encontrada"
            className="inline-flex h-11 items-center gap-2 rounded border border-border bg-white px-5 text-sm font-medium text-text transition-colors hover:bg-surface"
          >
            Encontré una mascota
            <Search className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {ACCIONES.map((accion) => (
          <Link
            key={accion.href}
            href={accion.href}
            className="group flex items-start gap-3 rounded-card border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-soft">
              <accion.icono className="h-5 w-5 text-primary" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text group-hover:text-primary">
                {accion.titulo}
              </span>
              <span className="mt-1 block text-sm text-muted">
                {accion.descripcion}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
