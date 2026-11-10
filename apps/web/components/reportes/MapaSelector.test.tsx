import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MapaSelector } from '@/components/reportes/MapaSelector';
import { capasDe, ultimoMapa } from '@/__mocks__/leaflet';

async function abrir(
  props: Partial<React.ComponentProps<typeof MapaSelector>> = {},
): Promise<HTMLElement> {
  render(<MapaSelector value={null} onChange={jest.fn()} {...props} />);
  return screen.findByTestId('mapa-selector');
}

afterEach(() => {
  Object.defineProperty(navigator, 'geolocation', {
    value: undefined,
    configurable: true,
  });
});

describe('MapaSelector (HU9 — Leaflet y OpenStreetMap)', () => {
  it('sin punto: centra en Cúcuta, sin marcador y con la atribución de OSM', async () => {
    await abrir();
    const mapa = ultimoMapa();
    expect(mapa.centro).toEqual({ lat: 7.8939, lng: -72.5078 });
    expect(capasDe(mapa, 'marker')).toHaveLength(0);
    const [teselas] = capasDe(mapa, 'tileLayer');
    expect(teselas.opciones.url).toBe(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(teselas.opciones.attribution).toMatch(/OpenStreetMap.*contributors/);
    expect(screen.getByTestId('mapa-coordenadas')).toHaveTextContent(
      'Aún no has marcado un punto',
    );
  });

  it('el clic emite latitud y longitud con 6 decimales', async () => {
    const onChange = jest.fn();
    await abrir({ onChange });
    ultimoMapa().clic(7.89391234567, -72.50781234567);
    expect(onChange).toHaveBeenCalledWith({ lat: 7.893912, lng: -72.507812 });
  });

  it('con un punto previo el marcador aparece ahí y el mapa se centra', async () => {
    await abrir({ value: { lat: 7.9, lng: -72.5 } });
    const mapa = ultimoMapa();
    expect(mapa.centro).toEqual({ lat: 7.9, lng: -72.5 });
    expect(capasDe(mapa, 'marker')[0].latlng).toEqual({ lat: 7.9, lng: -72.5 });
    expect(screen.getByTestId('mapa-coordenadas')).toHaveTextContent(
      'Punto marcado: 7.9, -72.5',
    );
  });

  it('un punto que llega después (borrador) mueve el marcador y centra el mapa', async () => {
    const { rerender } = render(
      <MapaSelector value={null} onChange={jest.fn()} />,
    );
    await screen.findByTestId('mapa-selector');
    rerender(
      <MapaSelector value={{ lat: 7.88, lng: -72.51 }} onChange={jest.fn()} />,
    );
    const mapa = ultimoMapa();
    expect(capasDe(mapa, 'marker')).toHaveLength(1);
    expect(mapa.centro).toEqual({ lat: 7.88, lng: -72.51 });
  });

  it('Enter marca el centro del mapa; el mapa es enfocable y tiene etiqueta', async () => {
    const onChange = jest.fn();
    const el = await abrir({ onChange });
    expect(el).toHaveAttribute('tabindex', '0');
    expect(el).toHaveAccessibleName(/marca la ubicación/i);
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ lat: 7.8939, lng: -72.5078 });
  });

  it('disabled: ni el clic ni Enter cambian el punto', async () => {
    const onChange = jest.fn();
    const el = await abrir({ onChange, disabled: true });
    expect(el).toHaveAttribute('aria-disabled', 'true');
    ultimoMapa().clic(7.9, -72.5);
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  describe('botón "Usar mi ubicación"', () => {
    function geolocalizacion(
      impl: (ok: PositionCallback, error: PositionErrorCallback) => void,
    ): jest.Mock {
      const getCurrentPosition = jest.fn(impl);
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition },
      });
      return getCurrentPosition;
    }

    it('no pide permiso al montar el componente', async () => {
      const pedir = geolocalizacion(() => undefined);
      await abrir();
      expect(pedir).not.toHaveBeenCalled();
    });

    it('al pulsarlo y aceptar, centra el mapa ahí sin marcar punto', async () => {
      geolocalizacion((ok) =>
        ok({ coords: { latitude: 4.6, longitude: -74.08 } } as GeolocationPosition),
      );
      const onChange = jest.fn();
      await abrir({ onChange });
      fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
      expect(ultimoMapa().centro).toEqual({ lat: 4.6, lng: -74.08 });
      expect(capasDe(ultimoMapa(), 'marker')).toHaveLength(0);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('si lo deniega, muestra un aviso y el mapa sigue usable', async () => {
      geolocalizacion((_ok, error) =>
        error({ code: 1, message: 'denied' } as GeolocationPositionError),
      );
      const onChange = jest.fn();
      await abrir({ onChange });
      fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
      expect(screen.getByRole('status')).toHaveTextContent(
        'No pudimos obtener tu ubicación',
      );
      expect(ultimoMapa().centro).toEqual({ lat: 7.8939, lng: -72.5078 });
      act(() => ultimoMapa().clic(7.9, -72.5));
      expect(onChange).toHaveBeenCalledWith({ lat: 7.9, lng: -72.5 });
    });

    it('sin geolocalización en el navegador no se muestra', async () => {
      await abrir();
      expect(
        screen.queryByRole('button', { name: 'Usar mi ubicación' }),
      ).not.toBeInTheDocument();
    });

    it('deshabilitado cuando el selector lo está', async () => {
      const pedir = geolocalizacion(() => undefined);
      await abrir({ disabled: true });
      const boton = screen.getByRole('button', { name: 'Usar mi ubicación' });
      expect(boton).toBeDisabled();
      fireEvent.click(boton);
      expect(pedir).not.toHaveBeenCalled();
    });
  });

  it('si las teselas fallan (sin internet) avisa que se puede escribir la dirección', async () => {
    await abrir();
    const [teselas] = capasDe(ultimoMapa(), 'tileLayer');
    act(() => teselas.fire('tileerror'));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Puedes describir la ubicación con texto',
    );
  });

  it('al desmontar elimina el mapa', async () => {
    const { unmount } = render(<MapaSelector value={null} onChange={jest.fn()} />);
    await screen.findByTestId('mapa-selector');
    const mapa = ultimoMapa();
    unmount();
    expect(mapa.eliminado).toBe(true);
  });
});
