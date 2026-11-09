'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { EditarReporte } from '@/components/reportes/EditarReporte';

// HU17: editar la información del reporte (solo el propietario).
export default function EditarReportePage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  return <EditarReporte id={params.id} />;
}
