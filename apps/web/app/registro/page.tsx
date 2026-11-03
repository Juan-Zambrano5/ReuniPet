import type { Metadata } from 'next';
import { RegistroForm } from '@/components/auth/RegistroForm';
import { TipCard } from '@/components/ui/TipCard';

export const metadata: Metadata = {
  title: 'Crear cuenta · ReuniPet',
};

// HU12: registro de usuarios.
export default function RegistroPage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <h1 className="text-2xl font-bold text-text">Crear cuenta</h1>
          <p className="mb-6 mt-1 text-sm text-muted">
            Regístrate para publicar reportes y hacerles seguimiento hasta el
            reencuentro.
          </p>
          <RegistroForm />
        </div>
        <TipCard
          titulo="Tu cuenta te permite publicar y seguir tus reportes"
          className="h-fit md:mt-16"
        >
          Con tu cuenta podrás reportar mascotas, recibir alertas de posibles
          coincidencias y actualizar el estado de tus reportes. Tu contraseña
          se guarda protegida y nunca se muestra.
        </TipCard>
      </div>
    </div>
  );
}
