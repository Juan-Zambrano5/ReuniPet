import type { LoginResponse } from '@reunipet/shared';

/**
 * HU16: sesión del frontend. Se guarda el token JWT (8 h) y el nombre para la
 * barra; nunca la contraseña ni el id como credencial. El token viaja en
 * `Authorization: Bearer` (lib/api.ts).
 *
 * Nota: localStorage es legible por cualquier script de la página, así que un
 * XSS podría leer el token; por eso vence a las 8 h. Pasar a cookie httpOnly
 * queda fuera del alcance del Sprint 4.
 */
export const SESION_TOKEN_KEY = 'reunipet:token';
export const SESION_NOMBRE_KEY = 'reunipet:nombre';
export const SESION_EVENTO = 'reunipet:sesion';

// Claves de la sesión simulada de los Sprints 1-3 (X-User-Id). Se borran al
// cargar la nueva versión (SPRINT4_PLAN §3.12).
const CLAVES_ANTIGUAS = ['x-user-id', 'x-user-nombre'];

export type MotivoLogin = 'expirada' | 'requerida';

function almacen(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function avisar(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESION_EVENTO));
  }
}

export function leerToken(): string | null {
  return almacen()?.getItem(SESION_TOKEN_KEY) ?? null;
}

export function haySesion(): boolean {
  return leerToken() !== null;
}

export function leerNombreSesion(): string | null {
  const s = almacen();
  if (!s?.getItem(SESION_TOKEN_KEY)) return null;
  return s.getItem(SESION_NOMBRE_KEY);
}

export function guardarSesion(sesion: LoginResponse): void {
  const s = almacen();
  if (!s) return;
  s.setItem(SESION_TOKEN_KEY, sesion.token);
  s.setItem(SESION_NOMBRE_KEY, sesion.usuario.nombre);
  avisar();
}

export function cerrarSesion(): void {
  const s = almacen();
  if (!s) return;
  s.removeItem(SESION_TOKEN_KEY);
  s.removeItem(SESION_NOMBRE_KEY);
  avisar();
}

/** Borra las claves de la sesión simulada anterior (x-user-id, x-user-nombre). */
export function limpiarSesionAntigua(): void {
  const s = almacen();
  if (!s) return;
  for (const clave of CLAVES_ANTIGUAS) s.removeItem(clave);
}

/**
 * Solo rutas internas: evita redirecciones abiertas (`//otro-sitio`,
 * `https://...`) a través del parámetro `siguiente`.
 */
export function rutaSegura(ruta: string | null | undefined): string | null {
  if (!ruta || !ruta.startsWith('/') || ruta.startsWith('//')) return null;
  if (ruta.startsWith('/login')) return null;
  return ruta;
}

export function urlLogin(motivo: MotivoLogin, siguiente?: string): string {
  const qs = new URLSearchParams({ motivo });
  const destino = rutaSegura(siguiente);
  if (destino) qs.set('siguiente', destino);
  return `/login?${qs.toString()}`;
}

/** Navegación aislada para poder sustituirla en pruebas (jsdom no navega). */
export const navegacion = {
  ir(url: string): void {
    window.location.assign(url);
  },
};

/**
 * HU16 AC4: un 401 en cualquier pantalla limpia la sesión y lleva a /login.
 * Si había token se muestra "Tu sesión expiró"; si no, "Inicia sesión".
 */
export function sesionNoAutorizada(): void {
  if (typeof window === 'undefined') return;
  const motivo: MotivoLogin = haySesion() ? 'expirada' : 'requerida';
  cerrarSesion();
  const { pathname, search } = window.location;
  if (pathname.startsWith('/login')) return;
  navegacion.ir(urlLogin(motivo, `${pathname}${search}`));
}
