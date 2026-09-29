export function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'hace instantes';
  if (mins < 60) return `hace ${mins} minuto(s)`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} hora(s)`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día(s)`;
}
