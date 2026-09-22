'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getAlertas } from '@/lib/api';

export default function ComparadorIndexPage(): React.JSX.Element {
  const router = useRouter();

  React.useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const alertas = await getAlertas();
        if (cancelado) return;
        if (alertas.length > 0) {
          router.replace(`/comparador/${alertas[0].coincidenciaId}`);
        } else {
          router.replace('/alertas');
        }
      } catch {
        if (!cancelado) router.replace('/alertas');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [router]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 text-center text-muted">
      Abriendo el comparador...
    </div>
  );
}
