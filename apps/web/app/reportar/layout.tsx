import { RequiereSesion } from '@/components/auth/RequiereSesion';

// HU16: esta sección exige sesión iniciada.
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <RequiereSesion>{children}</RequiereSesion>;
}
