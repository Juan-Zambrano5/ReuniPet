'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { ErrorText } from '@/components/ErrorText';

interface FormFieldProps {
  htmlFor: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

export function FormField({
  htmlFor,
  label,
  error,
  children,
}: FormFieldProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5" data-testid={`field-${htmlFor}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <ErrorText id={`${htmlFor}-error`}>{error}</ErrorText> : null}
    </div>
  );
}
