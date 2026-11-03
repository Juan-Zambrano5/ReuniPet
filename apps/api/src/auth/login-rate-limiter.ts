export const MAX_FALLOS = 5;
export const VENTANA_MS = 15 * 60 * 1000;

interface Registro {
  fallos: number;
  primerFallo: number;
  bloqueadoHasta: number | null;
}

/**
 * HU16 AC3: límite de intentos de login por correo, en memoria
 * (SPRINT4_PLAN §3.7). Tras MAX_FALLOS fallos seguidos dentro de la ventana,
 * el correo queda bloqueado VENTANA_MS. Un login correcto reinicia el conteo.
 * Se cuenta también para correos que no existen, para no revelar cuáles sí.
 * Al ser en memoria, se reinicia con la API y no se comparte entre réplicas.
 * Se registra con useFactory en AuthModule (el reloj es inyectable en pruebas).
 */
export class LoginRateLimiter {
  private readonly registros = new Map<string, Registro>();

  constructor(private readonly ahora: () => number = Date.now) {}

  estaBloqueado(email: string): boolean {
    this.purgar();
    const r = this.registros.get(email);
    return r?.bloqueadoHasta != null && r.bloqueadoHasta > this.ahora();
  }

  registrarFallo(email: string): void {
    const t = this.ahora();
    const r = this.registros.get(email);
    if (!r || t - r.primerFallo > VENTANA_MS) {
      this.registros.set(email, {
        fallos: 1,
        primerFallo: t,
        bloqueadoHasta: null,
      });
      return;
    }
    r.fallos += 1;
    if (r.fallos >= MAX_FALLOS) r.bloqueadoHasta = t + VENTANA_MS;
  }

  registrarExito(email: string): void {
    this.registros.delete(email);
  }

  /** Quita registros vencidos para que el mapa no crezca sin límite. */
  private purgar(): void {
    const t = this.ahora();
    for (const [email, r] of this.registros) {
      const vencidoBloqueo = r.bloqueadoHasta !== null && r.bloqueadoHasta <= t;
      const vencidaVentana =
        r.bloqueadoHasta === null && t - r.primerFallo > VENTANA_MS;
      if (vencidoBloqueo || vencidaVentana) this.registros.delete(email);
    }
  }
}
