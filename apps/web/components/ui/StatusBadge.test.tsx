import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EstadoReporte } from '@reunipet/shared';
import { BADGE_ESTADO, StatusBadge } from '@/components/ui/StatusBadge';

function renderEstado(estado: EstadoReporte): HTMLElement {
  const { variante, texto } = BADGE_ESTADO[estado];
  render(<StatusBadge variant={variante}>{texto}</StatusBadge>);
  return screen.getByTestId('status-badge');
}

describe('StatusBadge por estado del reporte', () => {
  it('RECUPERADA se muestra en índigo suave (SPRINT3_PLAN §4.3)', () => {
    const badge = renderEstado(EstadoReporte.RECUPERADA);
    expect(badge).toHaveTextContent('RECUPERADO');
    expect(badge).toHaveClass('bg-indigo-50', 'text-indigo-700');
  });

  it('PERDIDA (rojo) y ENCONTRADA (verde) no cambian', () => {
    expect(renderEstado(EstadoReporte.PERDIDA)).toHaveClass('text-danger');
    document.body.innerHTML = '';
    expect(renderEstado(EstadoReporte.ENCONTRADA)).toHaveClass('text-success');
  });
});
