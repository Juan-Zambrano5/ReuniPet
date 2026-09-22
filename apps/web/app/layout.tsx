import type { Metadata } from 'next';
import { AppNavbar } from '@/components/layout/AppNavbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReuniPet',
  description:
    'Reporte, búsqueda y reencuentro de mascotas perdidas y encontradas',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="es">
      <body>
        <AppNavbar />
        <main className="min-h-screen pt-16">{children}</main>
      </body>
    </html>
  );
}
