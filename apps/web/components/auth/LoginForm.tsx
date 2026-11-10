'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CUENTA_SUSPENDIDA } from '@reunipet/shared';
import { ApiError, guardarSesion, iniciarSesion } from '@/lib/api';
import { rutaSegura, type MotivoLogin } from '@/lib/sesion';

type Campo = 'email' | 'password';
type Errores = Partial<Record<Campo | 'general', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos';
export const MENSAJE_BLOQUEO =
  'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.';
export const MENSAJE_SUSPENDIDA =
  'Tu cuenta está suspendida. Contacta con un administrador.';

const AVISOS: Record<MotivoLogin, string> = {
  expirada: 'Tu sesión expiró. Inicia sesión de nuevo para continuar.',
  requerida: 'Inicia sesión para continuar.',
  suspendida: MENSAJE_SUSPENDIDA,
};

function validar(email: string, password: string): Errores {
  const e: Errores = {};
  if (!email.trim()) e.email = 'El correo es obligatorio';
  else if (!EMAIL_RE.test(email.trim()))
    e.email = 'El correo no tiene un formato válido';
  if (!password) e.password = 'La contraseña es obligatoria';
  return e;
}

// HU16 AC2/AC3: un único mensaje para credenciales incorrectas y otro para
// el bloqueo por intentos; nunca se dice cuál de los dos datos falló.
function erroresDelServidor(error: unknown): Errores {
  if (!(error instanceof ApiError)) {
    return { general: 'No se pudo conectar con el servidor. Intenta de nuevo.' };
  }
  if (error.status === 401) return { general: MENSAJE_CREDENCIALES };
  if (error.status === 429) return { general: MENSAJE_BLOQUEO };
  // HU19: solo llega con la contraseña correcta de una cuenta suspendida.
  if (
    error.status === 403 &&
    (error.body as { code?: unknown } | undefined)?.code === CUENTA_SUSPENDIDA
  ) {
    return { general: MENSAJE_SUSPENDIDA };
  }
  if (error.status === 400) {
    const body = error.body as { message?: string | string[] } | undefined;
    const mensajes = Array.isArray(body?.message)
      ? body.message
      : body?.message
        ? [body.message]
        : [];
    const e: Errores = {};
    for (const m of mensajes) {
      if (m.toLowerCase().includes('correo')) e.email ??= m;
      else if (m.toLowerCase().includes('contraseña')) e.password ??= m;
    }
    if (Object.keys(e).length > 0) return e;
  }
  return { general: 'No se pudo iniciar sesión. Intenta de nuevo.' };
}

interface LoginFormProps {
  motivo?: string | null;
  siguiente?: string | null;
}

export function LoginForm({
  motivo,
  siguiente,
}: LoginFormProps): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errores, setErrores] = React.useState<Errores>({});
  const [enviando, setEnviando] = React.useState(false);

  const aviso =
    motivo && Object.prototype.hasOwnProperty.call(AVISOS, motivo)
      ? AVISOS[motivo as MotivoLogin]
      : null;

  async function enviar(ev: React.FormEvent<HTMLFormElement>): Promise<void> {
    ev.preventDefault();
    const locales = validar(email, password);
    setErrores(locales);
    if (Object.keys(locales).length > 0) return;

    setEnviando(true);
    try {
      const sesion = await iniciarSesion({
        email: email.trim().toLowerCase(),
        password,
      });
      guardarSesion(sesion);
      router.push(rutaSegura(siguiente) ?? '/mis-reportes');
    } catch (error) {
      // AC3: el fallo no toca la sesión guardada; solo se informa.
      setErrores(erroresDelServidor(error));
      setEnviando(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(ev) => void enviar(ev)}
      className="flex flex-col gap-5 rounded-card border border-border bg-card p-6 shadow-card"
      aria-label="Formulario de inicio de sesión"
    >
      {aviso ? (
        <p
          role="status"
          className="rounded-control bg-primary-soft px-3 py-2 text-sm font-medium text-primary"
          data-testid="aviso-sesion"
        >
          {aviso}
        </p>
      ) : null}

      <FormField htmlFor="email" label="Correo electrónico" error={errores.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          value={email}
          onChange={(ev) => {
            setEmail(ev.target.value);
            if (errores.email) setErrores((e) => ({ ...e, email: undefined }));
          }}
          aria-invalid={errores.email ? true : undefined}
          aria-describedby={errores.email ? 'email-error' : undefined}
        />
      </FormField>

      <FormField htmlFor="password" label="Contraseña" error={errores.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(ev) => {
            setPassword(ev.target.value);
            if (errores.password)
              setErrores((e) => ({ ...e, password: undefined }));
          }}
          aria-invalid={errores.password ? true : undefined}
          aria-describedby={errores.password ? 'password-error' : undefined}
        />
      </FormField>

      {errores.general ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {errores.general}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="w-full">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {enviando ? 'Entrando…' : 'Iniciar sesión'}
      </Button>

      <p className="text-center text-sm text-muted">
        ¿No tienes cuenta?{' '}
        <Link href="/registro" className="font-medium text-primary hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
