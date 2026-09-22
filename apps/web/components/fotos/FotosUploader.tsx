'use client';

import * as React from 'react';
import Link from 'next/link';
import { FotografiaResponse } from '@reunipet/shared';
import { AppHeader } from '@/components/AppHeader';
import { PhotoUploadSlot } from '@/components/fotos/PhotoUploadSlot';
import { ErrorText } from '@/components/ErrorText';
import { Button } from '@/components/ui/button';
import { ApiError, API_URL, getSessionHeaders } from '@/lib/api';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Slot {
  id: number;
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  savedUrl: string | null;
}

function newSlot(id: number): Slot {
  return { id, file: null, previewUrl: null, error: null, savedUrl: null };
}

async function uploadFotos(
  reporteId: string,
  files: File[],
): Promise<FotografiaResponse[]> {
  const formData = new FormData();
  for (const file of files) formData.append('fotos', file);

  const res = await fetch(`${API_URL}/reportes/${reporteId}/fotos`, {
    method: 'POST',
    headers: getSessionHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as FotografiaResponse[];
}

export function FotosUploader({
  reporteId,
}: {
  reporteId: string;
}): React.JSX.Element {
  const [slots, setSlots] = React.useState<Slot[]>(() => [
    newSlot(1),
    newSlot(2),
    newSlot(3),
  ]);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [nextId, setNextId] = React.useState(4);
  const previewsRef = React.useRef<Map<number, string>>(new Map());

  React.useEffect(() => {
    const urls = previewsRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, []);

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'El archivo no es una imagen JPG, PNG o WEBP válida';
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return 'La imagen supera el máximo de 5MB';
    }
    return null;
  }

  function handleSelect(slotIdx: number, file: File): void {
    const error = validateFile(file);
    setSuccessMsg(null);
    setSaveError(null);

    setSlots((prev) =>
      prev.map((slot, i) => {
        if (i !== slotIdx) return slot;
        const old = slot.previewUrl;
        if (old) {
          URL.revokeObjectURL(old);
          previewsRef.current.delete(slot.id);
        }
        if (error) {
          return { ...slot, file: null, previewUrl: null, error, savedUrl: null };
        }
        const url = URL.createObjectURL(file);
        previewsRef.current.set(slot.id, url);
        return { ...slot, file, previewUrl: url, error: null, savedUrl: null };
      }),
    );
  }

  function handleClear(slotIdx: number): void {
    setSlots((prev) =>
      prev.map((slot, i) => {
        if (i !== slotIdx) return slot;
        if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
        previewsRef.current.delete(slot.id);
        return { ...slot, file: null, previewUrl: null, error: null };
      }),
    );
  }

  function addSlot(): void {
    setSlots((prev) => [...prev, newSlot(nextId)]);
    setNextId((n) => n + 1);
  }

  async function handleSave(): Promise<void> {
    setSaveError(null);
    setSuccessMsg(null);

    const validIndexes = slots
      .map((slot, i) => ({ slot, i }))
      .filter(({ slot }) => slot.file !== null && !slot.error)
      .map(({ i }) => i);

    if (validIndexes.length === 0) {
      setSaveError('Selecciona al menos una fotografía válida para guardar.');
      return;
    }

    setSaving(true);
    try {
      const files = validIndexes.map((i) => slots[i].file as File);
      await uploadFotos(reporteId, files);

      setSlots((prev) =>
        prev.map((slot, i) => {
          if (!validIndexes.includes(i)) return slot;
          if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
          previewsRef.current.delete(slot.id);
          return {
            ...slot,
            file: null,
            previewUrl: null,
            error: null,
            savedUrl: 'ok',
          };
        }),
      );
      setSuccessMsg(
        `${files.length} fotografía(s) guardada(s). Puedes agregar más si lo deseas.`,
      );
    } catch (err) {
      // RNF-05: no se pierden las fotos ya subidas ni el reporte
      if (err instanceof ApiError) {
        const body = err.body as { message?: string | string[] } | undefined;
        const msg = Array.isArray(body?.message)
          ? body.message.join(', ')
          : (body?.message ?? 'No se pudieron guardar las fotografías.');
        setSaveError(msg);
      } else {
        setSaveError('Error de conexión. Tus fotos seleccionadas se conservan.');
      }
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = slots.filter((s) => s.file && !s.error).length;
  const savedCount = slots.filter((s) => s.savedUrl).length;

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-text">Carga de fotografías</h1>
        <p className="mt-1 text-sm text-muted">
          Agrega fotos de la mascota para mejorar las posibilidades de
          reencuentro. Formatos: JPG, PNG o WEBP, máximo 5MB cada una.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-4">
          {slots.map((slot, idx) => (
            <PhotoUploadSlot
              key={slot.id}
              slotId={String(slot.id)}
              previewUrl={slot.previewUrl ?? undefined}
              error={slot.error ?? undefined}
              onSelect={(file) => handleSelect(idx, file)}
              onClear={() => handleClear(idx)}
              disabled={saving}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={addSlot}
            disabled={saving}
            className="sm:flex-1"
          >
            Agregar otra foto
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="sm:flex-1"
            data-testid="guardar-fotos"
          >
            {saving ? 'Guardando...' : 'Guardar fotografías'}
          </Button>
        </div>

        {saveError && (
          <div className="mt-4">
            <ErrorText>{saveError}</ErrorText>
          </div>
        )}
        {successMsg && (
          <p
            role="status"
            className="mt-4 rounded bg-primary-soft px-4 py-3 text-sm text-primary"
            data-testid="success-msg"
          >
            {successMsg}
          </p>
        )}

        <p className="mt-4 text-xs text-muted" data-testid="upload-counts">
          Pendientes: {pendingCount} · Guardadas en este reporte: {savedCount}
        </p>

        <div className="mt-8">
          <Link href="/" className="text-sm text-primary hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
