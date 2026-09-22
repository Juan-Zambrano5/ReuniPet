import type { Metadata } from 'next';
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
      <body>{children}</body>
    </html>
  );
}
