import { RequiereSesion } from '@/components/auth/RequiereSesion';

// HU17: editar exige sesión (el detalle /reportes/[id] sigue siendo público).
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <RequiereSesion>{children}</RequiereSesion>;
}
