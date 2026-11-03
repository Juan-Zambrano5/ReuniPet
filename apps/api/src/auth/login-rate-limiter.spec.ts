import { LoginRateLimiter, MAX_FALLOS, VENTANA_MS } from './login-rate-limiter';

describe('LoginRateLimiter (HU16 AC3)', () => {
  let reloj: number;
  let limitador: LoginRateLimiter;

  beforeEach(() => {
    reloj = 0;
    limitador = new LoginRateLimiter(() => reloj);
  });

  function fallar(email: string, veces: number): void {
    for (let i = 0; i < veces; i++) limitador.registrarFallo(email);
  }

  it('bloquea al llegar a 5 fallos, no antes', () => {
    fallar('a@b.co', MAX_FALLOS - 1);
    expect(limitador.estaBloqueado('a@b.co')).toBe(false);
    limitador.registrarFallo('a@b.co');
    expect(limitador.estaBloqueado('a@b.co')).toBe(true);
  });

  it('el bloqueo dura 15 minutos', () => {
    fallar('a@b.co', MAX_FALLOS);
    reloj += VENTANA_MS - 1;
    expect(limitador.estaBloqueado('a@b.co')).toBe(true);
    reloj += 2;
    expect(limitador.estaBloqueado('a@b.co')).toBe(false);
  });

  it('fallos separados por más de 15 minutos no se acumulan', () => {
    fallar('a@b.co', MAX_FALLOS - 1);
    reloj += VENTANA_MS + 1;
    limitador.registrarFallo('a@b.co');
    expect(limitador.estaBloqueado('a@b.co')).toBe(false);
  });

  it('cada correo lleva su propio conteo', () => {
    fallar('a@b.co', MAX_FALLOS);
    expect(limitador.estaBloqueado('otro@b.co')).toBe(false);
  });
});
