'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ReporteDetalle } from '@/components/reportes/ReporteDetalle';

export default function ReporteDetallePage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  return <ReporteDetalle id={params.id} />;
}
