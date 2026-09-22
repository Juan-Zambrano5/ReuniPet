'use client';

import * as React from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorText } from '@/components/ErrorText';

interface PhotoUploadSlotProps {
  previewUrl?: string;
  error?: string;
  onSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
  slotId: string;
}

export function PhotoUploadSlot({
  previewUrl,
  error,
  onSelect,
  onClear,
  disabled,
  slotId,
}: PhotoUploadSlotProps): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) onSelect(file);
    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-1.5" data-testid={`slot-${slotId}`}>
      <div
        className={cn(
          'relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-card border-2 border-dashed transition-colors',
          error
            ? 'border-danger bg-red-50'
            : 'border-[#C7C9D1] bg-surface hover:border-primary hover:bg-primary-soft',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        aria-label={`Seleccionar fotografía ${slotId}`}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        tabIndex={disabled ? -1 : 0}
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`Vista previa de la fotografía ${slotId}`}
              className="h-full w-full object-cover"
            />
            {!disabled && (
              <button
                type="button"
                aria-label="Quitar fotografía"
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1.5 text-danger shadow hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
          </>
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-2 text-center">
            <Camera className="h-8 w-8 text-muted" aria-hidden />
            <span className="text-xs font-medium text-muted">
              Subir más fotos
            </span>
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
          data-testid={`input-${slotId}`}
        />
      </div>
      {error && <ErrorText id={`slot-${slotId}-error`}>{error}</ErrorText>}
    </div>
  );
}
