import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconoUrl from 'leaflet/dist/images/marker-icon.png';
import iconoRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import sombraUrl from 'leaflet/dist/images/marker-shadow.png';

export interface Coordenadas {
  lat: number;
  lng: number;
}

function coord(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor);
  return valor && Number.isFinite(n) ? n : porDefecto;
}

// Cúcuta (ejemplo del prototipo); configurable en el build sin ser obligatorio.
export const CENTRO_POR_DEFECTO: Coordenadas = {
  lat: coord(process.env.NEXT_PUBLIC_MAPA_LAT, 7.8939),
  lng: coord(process.env.NEXT_PUBLIC_MAPA_LNG, -72.5078),
};

export const ZOOM_CIUDAD = 13;
export const ZOOM_PUNTO = 16;

// El bundler cambia las rutas de las imágenes: el icono por defecto de
// Leaflet las busca relativas a su CSS y se rompe, así que se pasan explícitas.
export const iconoMarcador = L.icon({
  iconUrl: iconoUrl.src,
  iconRetinaUrl: iconoRetinaUrl.src,
  shadowUrl: sombraUrl.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Mapa con teselas de OpenStreetMap y su atribución (obligatoria). */
export function crearMapa(
  contenedor: HTMLElement,
  centro: Coordenadas,
  zoom: number,
  alFallarTeselas: () => void,
): L.Map {
  const mapa = L.map(contenedor).setView([centro.lat, centro.lng], zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  })
    .on('tileerror', alFallarTeselas)
    .addTo(mapa);
  return mapa;
}
