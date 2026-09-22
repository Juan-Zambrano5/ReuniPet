import { cn } from '@/lib/utils';

export function AppHeader({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  return (
    <header
      className={cn('w-full bg-primary px-4 py-4 sm:px-6', className)}
      data-testid="app-header"
    >
      <div className="container flex items-center">
        <span className="text-xl font-bold text-white">ReuniPet</span>
      </div>
    </header>
  );
}
