export function ErrorText({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}): React.JSX.Element {
  return (
    <p
      id={id}
      role="alert"
      className="mt-1 text-sm font-medium text-destructive"
      data-testid="error-text"
    >
      {children}
    </p>
  );
}
