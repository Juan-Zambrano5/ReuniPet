import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';
import { TipCard } from '@/components/ui/TipCard';

export const metadata: Metadata = {
  title: 'Iniciar sesión · ReuniPet',
};

interface LoginPageProps {
  searchParams: Promise<{ motivo?: string; siguiente?: string }>;
}

// HU16: inicio de sesión, con el mismo lenguaje visual de /registro.
export default async function LoginPage({
  searchParams,
}: LoginPageProps): Promise<React.JSX.Element> {
  const { motivo, siguiente } = await searchParams;
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <h1 className="text-2xl font-bold text-text">Iniciar sesión</h1>
          <p className="mb-6 mt-1 text-sm text-muted">
            Entra con tu correo y contraseña para gestionar tus reportes y ver
            tus alertas.
          </p>
          <LoginForm motivo={motivo ?? null} siguiente={siguiente ?? null} />
        </div>
        <TipCard
          titulo="Tu sesión dura 8 horas"
          className="h-fit md:mt-16"
        >
          Por seguridad, la sesión se cierra sola a las 8 horas y después de
          5 intentos fallidos el acceso se bloquea 15 minutos. Si aún no tienes
          cuenta, puedes{' '}
          <Link href="/registro" className="font-medium text-primary hover:underline">
            crear una aquí
          </Link>
          .
        </TipCard>
      </div>
    </div>
  );
}
