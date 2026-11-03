'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ApiError, guardarSesion, registrarUsuario } from '@/lib/api';

type Campo = 'nombre' | 'email' | 'telefono' | 'password' | 'confirmar';
type Valores = Record<Campo, string>;
type Errores = Partial<Record<Campo | 'general', string>>;

const VACIO: Valores = {
  nombre: '',
  email: '',
  telefono: '',
  password: '',
  confirmar: '',
};

// Mismo criterio práctico que el backend (@IsEmail): algo@dominio.tld
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

// HU12 AC3: validación en cliente, mismos mensajes que el backend.
export function validarRegistro(v: Valores): Errores {
  const e: Errores = {};
  if (!v.nombre.trim()) e.nombre = 'El nombre es obligatorio';
  if (!v.email.trim()) e.email = 'El correo es obligatorio';
  else if (!EMAIL_RE.test(v.email.trim()))
    e.email = 'El correo no tiene un formato válido';
  if (v.password.length < MIN_PASSWORD)
    e.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
  if (v.confirmar !== v.password) e.confirmar = 'Las contraseñas no coinciden';
  return e;
}

// Ubica cada mensaje 400 del backend junto a su campo.
function erroresDelServidor(error: unknown): Errores {
  if (!(error instanceof ApiError)) {
    return { general: 'No se pudo conectar con el servidor. Intenta de nuevo.' };
  }
  if (error.status === 409) return { email: 'El correo ya está registrado' };

  const body = error.body as { message?: string | string[] } | undefined;
  const mensajes = Array.isArray(body?.message)
    ? body.message
    : body?.message
      ? [body.message]
      : [];
  const e: Errores = {};
  for (const m of mensajes) {
    const l = m.toLowerCase();
    if (l.includes('nombre')) e.nombre ??= m;
    else if (l.includes('correo')) e.email ??= m;
    else if (l.includes('teléfono')) e.telefono ??= m;
    else if (l.includes('contraseña')) e.password ??= m;
    else e.general ??= m;
  }
  if (Object.keys(e).length === 0) {
    e.general = 'No se pudo crear la cuenta. Intenta de nuevo.';
  }
  return e;
}

export function RegistroForm(): React.JSX.Element {
  const router = useRouter();
  const [valores, setValores] = React.useState<Valores>(VACIO);
  const [errores, setErrores] = React.useState<Errores>({});
  const [enviando, setEnviando] = React.useState(false);

  function cambiar(campo: Campo) {
    return (ev: React.ChangeEvent<HTMLInputElement>): void => {
      const valor = ev.target.value;
      setValores((v) => ({ ...v, [campo]: valor }));
      if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    };
  }

  async function enviar(ev: React.FormEvent<HTMLFormElement>): Promise<void> {
    ev.preventDefault();
    const locales = validarRegistro(valores);
    setErrores(locales);
    if (Object.keys(locales).length > 0) return;

    setEnviando(true);
    try {
      const usuario = await registrarUsuario({
        nombre: valores.nombre.trim(),
        email: valores.email.trim().toLowerCase(),
        telefono: valores.telefono.trim() || undefined,
        password: valores.password,
      });
      // Sesión simulada (falsificable hasta HU16): ver guardarSesion.
      guardarSesion(usuario);
      router.push('/mis-reportes');
    } catch (error) {
      setErrores(erroresDelServidor(error));
      setEnviando(false);
    }
  }

  function inputProps(campo: Campo): React.ComponentProps<'input'> {
    return {
      id: campo,
      name: campo,
      value: valores[campo],
      onChange: cambiar(campo),
      'aria-invalid': errores[campo] ? true : undefined,
      'aria-describedby': errores[campo] ? `${campo}-error` : undefined,
    };
  }

  return (
    <form
      noValidate
      onSubmit={(ev) => void enviar(ev)}
      className="flex flex-col gap-5 rounded-card border border-border bg-card p-6 shadow-card"
      aria-label="Formulario de registro"
    >
      <FormField htmlFor="nombre" label="Nombre completo" error={errores.nombre}>
        <Input {...inputProps('nombre')} autoComplete="name" placeholder="Ej: Ana Gómez" />
      </FormField>

      <FormField htmlFor="email" label="Correo electrónico" error={errores.email}>
        <Input
          {...inputProps('email')}
          type="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
        />
      </FormField>

      <FormField htmlFor="telefono" label="Teléfono (opcional)" error={errores.telefono}>
        <Input
          {...inputProps('telefono')}
          type="tel"
          autoComplete="tel"
          placeholder="Ej: 300 123 4567"
        />
      </FormField>

      <FormField htmlFor="password" label="Contraseña" error={errores.password}>
        <Input {...inputProps('password')} type="password" autoComplete="new-password" />
        {!errores.password ? (
          <p className="text-xs text-muted">Mínimo {MIN_PASSWORD} caracteres.</p>
        ) : null}
      </FormField>

      <FormField htmlFor="confirmar" label="Confirmar contraseña" error={errores.confirmar}>
        <Input {...inputProps('confirmar')} type="password" autoComplete="new-password" />
      </FormField>

      {errores.general ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {errores.general}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="w-full">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
      </Button>
    </form>
  );
}
