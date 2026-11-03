'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TipoReporte } from '@reunipet/shared';
import { FormField } from '@/components/FormField';
import { EspecieSelector } from '@/components/reportes/EspecieSelector';
import type { PuntoMapa } from '@/components/reportes/MapaSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { guardarBorrador, leerBorrador, rutaPaso2 } from '@/lib/borrador';

interface ReporteFormProps {
  tipo: TipoReporte;
  /** HU9: punto marcado en el mapa; se envía como latitud/longitud. */
  punto?: PuntoMapa | null;
}

interface FormState {
  especie: string;
  raza: string;
  color: string;
  caracteristicasDistintivas: string;
  ubicacion: string;
}

const initialForm: FormState = {
  especie: '',
  raza: '',
  color: '',
  caracteristicasDistintivas: '',
  ubicacion: '',
};

function clientValidate(
  form: FormState,
  tipo: TipoReporte,
  punto: PuntoMapa | null,
): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.especie.trim()) errors.especie = 'La especie es obligatoria';
  if (!form.color.trim()) errors.color = 'El color es obligatorio';
  if (!form.caracteristicasDistintivas.trim()) {
    errors.caracteristicasDistintivas =
      'Las características distintivas son obligatorias';
  }
  // HU9 AC1: en ENCONTRADA basta con la dirección escrita o el punto en el mapa.
  if (tipo === TipoReporte.ENCONTRADA && !form.ubicacion.trim() && !punto) {
    errors.ubicacion = 'Indica la ubicación con texto o marca un punto en el mapa';
  }
  return errors;
}

export function ReporteForm({
  tipo,
  punto,
}: ReporteFormProps): React.JSX.Element {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof FormState, string>>
  >({});

  const esPerdida = tipo === TipoReporte.PERDIDA;
  const boton = 'Siguiente paso';

  // HU1/HU3: al volver del paso 2 (o tras una recarga) se recuperan los datos
  // guardados en el borrador. Solo si el borrador es de ESTE tipo de reporte.
  React.useEffect(() => {
    const borrador = leerBorrador();
    if (!borrador || borrador.tipo !== tipo) return;
    setForm({
      especie: borrador.especie,
      raza: borrador.raza,
      color: borrador.color,
      caracteristicasDistintivas: borrador.caracteristicasDistintivas,
      ubicacion: borrador.ubicacion,
    });
  }, [tipo]);

  function updateField(field: keyof FormState, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function updateEspecie(value: string): void {
    setForm((prev) => ({ ...prev, especie: value }));
    setErrors((prev) => {
      if (!prev.especie) return prev;
      const next = { ...prev };
      delete next.especie;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();

    const clientErrors = clientValidate(form, tipo, punto ?? null);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    // HU1/HU3 (paso 1 de 2): aquí NO se publica. Se guarda el borrador en el
    // navegador y se navega al paso 2, que es quien crea el reporte y sube
    // las fotos opcionales.
    guardarBorrador({
      tipo,
      especie: form.especie.trim(),
      raza: form.raza.trim(),
      color: form.color.trim(),
      caracteristicasDistintivas: form.caracteristicasDistintivas.trim(),
      ubicacion: form.ubicacion.trim(),
      latitud: punto?.lat,
      longitud: punto?.lng,
    });
    router.push(rutaPaso2(tipo));
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-6 shadow-card"
      onSubmit={handleSubmit}
      noValidate
      data-testid="reporte-form"
    >
      <EspecieSelector
        value={form.especie}
        onChange={updateEspecie}
        error={errors.especie}
      />

      <FormField htmlFor="raza" label="Raza (opcional)" error={errors.raza}>
        <Input
          id="raza"
          name="raza"
          placeholder="Ej: labrador, mestizo..."
          value={form.raza}
          onChange={(e) => updateField('raza', e.target.value)}
        />
      </FormField>

      <FormField htmlFor="color" label="Color" error={errors.color}>
        <Input
          id="color"
          name="color"
          placeholder="Ej: negro con manchas blancas"
          value={form.color}
          onChange={(e) => updateField('color', e.target.value)}
          aria-invalid={errors.color ? true : undefined}
          aria-describedby={errors.color ? 'color-error' : undefined}
        />
      </FormField>

      <FormField
        htmlFor="caracteristicasDistintivas"
        label="Características distintivas"
        error={errors.caracteristicasDistintivas}
      >
        <Textarea
          id="caracteristicasDistintivas"
          name="caracteristicasDistintivas"
          placeholder="Ej: collar rojo, oreja izquierda cortada, camina cojeando..."
          value={form.caracteristicasDistintivas}
          onChange={(e) =>
            updateField('caracteristicasDistintivas', e.target.value)
          }
          aria-invalid={
            errors.caracteristicasDistintivas ? true : undefined
          }
          aria-describedby={
            errors.caracteristicasDistintivas
              ? 'caracteristicasDistintivas-error'
              : undefined
          }
        />
      </FormField>

      <FormField
        htmlFor="ubicacion"
        label={esPerdida ? 'Ubicación (opcional)' : 'Ubicación'}
        error={errors.ubicacion}
      >
        <Input
          id="ubicacion"
          name="ubicacion"
          placeholder={
            esPerdida
              ? 'Ej: cerca del parque Bolívar, avenida principal'
              : 'Ej: Av. Principal y Calle 5, cerca del parque'
          }
          value={form.ubicacion}
          onChange={(e) => updateField('ubicacion', e.target.value)}
          aria-invalid={errors.ubicacion ? true : undefined}
          aria-describedby={errors.ubicacion ? 'ubicacion-error' : undefined}
        />
      </FormField>

      <Button type="submit" className="mt-1 w-full">
        {boton}
      </Button>
    </form>
  );
}
