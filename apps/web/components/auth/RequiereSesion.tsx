'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { haySesion, urlLogin } from '@/lib/sesion';

/**
 * HU16 AC4: envuelve las pantallas que exigen sesión (reportar, mis reportes,
 * alertas, comparador). Sin token lleva a /login antes de mostrar nada; un
 * token vencido lo detecta el primer 401 del API (lib/api.ts → apiFetch).
 */
export function RequiereSesion({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element | null {
  const router = useRouter();
  const pathname = usePathname();
  // null = aún no se sabe (localStorage solo existe en el navegador).
  const [conSesion, setConSesion] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const ok = haySesion();
    setConSesion(ok);
    if (!ok) router.replace(urlLogin('requerida', pathname));
  }, [router, pathname]);

  if (!conSesion) {
    return (
      <p className="py-12 text-center text-sm text-muted" role="status">
        {conSesion === false ? 'Redirigiendo al inicio de sesión…' : 'Cargando…'}
      </p>
    );
  }
  return <>{children}</>;
}
