// Mock de Leaflet para Jest (jsdom no dibuja mapas). Se usa automáticamente
// al importar 'leaflet'. Las pruebas importan los helpers desde
// '@/__mocks__/leaflet': esa es otra instancia del módulo, así que el
// registro de mapas vive en globalThis para que ambas lo compartan.

type LatLngTupla = [number, number];
type Handler = (e: unknown) => void;

const aLatLng = ([lat, lng]: LatLngTupla) => ({ lat, lng });

class Evented {
  handlers: Record<string, Handler[]> = {};
  on(evento: string, h: Handler): this {
    (this.handlers[evento] ??= []).push(h);
    return this;
  }
  fire(evento: string, datos: unknown = {}): void {
    (this.handlers[evento] ?? []).forEach((h) => h(datos));
  }
}

export class MapaFalso extends Evented {
  centro = { lat: 0, lng: 0 };
  zoom = 0;
  capas: Capa[] = [];
  eliminado = false;
  /** Lo que contiene la vista; las pruebas lo cambian para forzar el centrado. */
  contieneVista = false;
  scrollWheelZoom = {
    activo: true,
    disable(): void {
      this.activo = false;
    },
  };
  constructor(public contenedor: HTMLElement) {
    super();
  }
  setView(c: LatLngTupla, zoom: number): this {
    this.centro = aLatLng(c);
    this.zoom = zoom;
    return this;
  }
  getCenter() {
    return this.centro;
  }
  getZoom(): number {
    return this.zoom;
  }
  getBounds() {
    return { contains: () => this.contieneVista };
  }
  remove(): void {
    this.eliminado = true;
  }
  /** Simula un clic del usuario en esas coordenadas. */
  clic(lat: number, lng: number): void {
    this.fire('click', { latlng: { lat, lng } });
  }
}

export class Capa extends Evented {
  mapa: MapaFalso | null = null;
  constructor(
    public tipo: 'marker' | 'circle' | 'tileLayer',
    public latlng: { lat: number; lng: number } | null,
    public opciones: Record<string, unknown> = {},
  ) {
    super();
  }
  addTo(mapa: MapaFalso): this {
    this.mapa = mapa;
    mapa.capas.push(this);
    return this;
  }
  setLatLng(c: LatLngTupla): this {
    this.latlng = aLatLng(c);
    return this;
  }
  remove(): this {
    if (this.mapa) this.mapa.capas = this.mapa.capas.filter((c) => c !== this);
    this.mapa = null;
    return this;
  }
}

const registro = globalThis as { __mapasLeaflet?: MapaFalso[] };
export const mapas: MapaFalso[] = (registro.__mapasLeaflet ??= []);
export const ultimoMapa = (): MapaFalso => {
  const m = mapas[mapas.length - 1];
  if (!m) throw new Error('No se creó ningún mapa');
  return m;
};
export const capasDe = (mapa: MapaFalso, tipo: Capa['tipo']): Capa[] =>
  mapa.capas.filter((c) => c.tipo === tipo);

const L = {
  map: (el: HTMLElement) => {
    const m = new MapaFalso(el);
    mapas.push(m);
    return m;
  },
  tileLayer: (url: string, opciones: Record<string, unknown>) =>
    new Capa('tileLayer', null, { url, ...opciones }),
  marker: (c: LatLngTupla, opciones?: Record<string, unknown>) =>
    new Capa('marker', aLatLng(c), opciones),
  circle: (c: LatLngTupla, opciones?: Record<string, unknown>) =>
    new Capa('circle', aLatLng(c), opciones),
  icon: (opciones: Record<string, unknown>) => opciones,
};

export default L;
