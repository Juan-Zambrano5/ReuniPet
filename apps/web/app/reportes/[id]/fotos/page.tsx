import { FotosUploader } from '@/components/fotos/FotosUploader';

export const dynamic = 'force-dynamic';

export default async function FotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <FotosUploader reporteId={id} />;
}
