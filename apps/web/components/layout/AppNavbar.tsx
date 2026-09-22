'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, PawPrint, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavLink {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
}

const LINKS: NavLink[] = [
  {
    href: '/reportar/perdida',
    label: 'Reportar Mascota',
    isActive: (p) => p.startsWith('/reportar'),
  },
  {
    href: '/alertas',
    label: 'Alertas Activas',
    isActive: (p) => p.startsWith('/alertas'),
  },
  {
    href: '/mapa',
    label: 'Buscar en Mapa',
    isActive: (p) => p.startsWith('/mapa'),
  },
  {
    href: '/comparador',
    label: 'Comparador Inteligente',
    isActive: (p) => /^\/comparador\/.+/.test(p),
  },
];

export function AppNavbar(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-white shadow-card">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" data-testid="brand">
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-primary">
            <PawPrint className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-primary">ReuniPet</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              PETFINDER IA
            </span>
          </span>
        </Link>

        <nav
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
          aria-label="Navegación principal"
        >
          {LINKS.map((link) => {
            const active = link.isActive(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-16 shrink-0 items-center whitespace-nowrap px-3 text-sm font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted hover:text-text',
                )}
              >
                {link.label}
                <span
                  className={cn(
                    'absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary transition-opacity',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/alertas"
            aria-label="Notificaciones"
            className="relative rounded-control p-2 text-muted transition-colors hover:bg-primary-soft hover:text-primary"
          >
            <Bell className="h-5 w-5" aria-hidden />
          </Link>
          <span
            aria-label="Avatar de usuario"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary"
          >
            <User className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </div>
    </header>
  );
}
