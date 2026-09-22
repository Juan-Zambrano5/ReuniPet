'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TipoReporte } from '@reunipet/shared';
import { FormField } from '@/components/FormField';
import { EspecieSelector } from '@/components/reportes/EspecieSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ApiError,
  createReporte,
  extractFieldErrors,
} from '@/lib/api';

interface ReporteFormProps {
  tipo: TipoReporte;
  submitLabel?: string;
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
): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.especie.trim()) errors.especie = 'La especie es obligatoria';
  if (!form.color.trim()) errors.color = 'El color es obligatorio';
  if (!form.caracteristicasDistintivas.trim()) {
    errors.caracteristicasDistintivas =
      'Las características distintivas son obligatorias';
  }
  if (tipo === TipoReporte.ENCONTRADA && !form.ubicacion.trim()) {
    errors.ubicacion = 'La ubicación es obligatoria';
  }
  return errors;
}

export function ReporteForm({ tipo, submitLabel }: ReporteFormProps): React.JSX.Element {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const esPerdida = tipo === TipoReporte.PERDIDA;
  const boton =
    submitLabel ?? (esPerdida ? 'Siguiente paso' : 'Publicar reporte');

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

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    e.preventDefault();
    setServerError(null);

    const clientErrors = clientValidate(form, tipo);
    setErrors(clientErrors);

    setSubmitting(true);
    try {
      const reporte = await createReporte({
        tipo,
        especie: form.especie.trim(),
        raza: form.raza.trim() || undefined,
        color: form.color.trim(),
        caracteristicasDistintivas: form.caracteristicasDistintivas.trim(),
        ubicacion:
          tipo === TipoReporte.ENCONTRADA ? form.ubicacion.trim() : undefined,
      });
      if (esPerdida) {
        router.push(`/reportar/perdida/fotos?id=${reporte.id}`);
      } else {
        router.push('/');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = extractFieldErrors(err);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors as Partial<Record<keyof FormState, string>>);
        } else {
          setServerError('No se pudo publicar el reporte. Intenta de nuevo.');
        }
      } else {
        setServerError('Error de conexión con el servidor.');
      }
      setSubmitting(false);
    }
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

      {!esPerdida && (
        <FormField
          htmlFor="ubicacion"
          label="Ubicación"
          error={errors.ubicacion}
        >
          <Input
            id="ubicacion"
            name="ubicacion"
            placeholder="Ej: Av. Principal y Calle 5, cerca del parque"
            value={form.ubicacion}
            onChange={(e) => updateField('ubicacion', e.target.value)}
            aria-invalid={errors.ubicacion ? true : undefined}
            aria-describedby={errors.ubicacion ? 'ubicacion-error' : undefined}
          />
        </FormField>
      )}

      {serverError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="mt-1 w-full">
        {submitting ? 'Publicando...' : boton}
      </Button>
    </form>
  );
}
