import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  PAYMENT_LINK_TTL_DAYS,
  PAYMENT_LINK_TTL_MS,
  paymentLinkExpiresAt,
} from '../expiration';

/** Hora de pared en America/Santiago, independiente de la zona del runtime. */
function santiagoWallClock(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
  }).format(date);
}

describe('paymentLinkExpiresAt', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expira exactamente 7 x 24h despues de la emision', () => {
    const from = new Date('2026-05-20T15:00:00.000Z');
    expect(paymentLinkExpiresAt(from).getTime() - from.getTime()).toBe(PAYMENT_LINK_TTL_MS);
    expect(PAYMENT_LINK_TTL_DAYS).toBe(7);
  });

  it('usa "ahora" cuando no recibe origen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T15:00:00.000Z'));
    expect(paymentLinkExpiresAt().toISOString()).toBe('2026-05-27T15:00:00.000Z');
  });

  // Regresion: `addDays` de date-fns suma dias en wall-time del runtime, asi que
  // una ventana que cruza el cambio de horario chileno dura 167h en un equipo en
  // America/Santiago y 168h en Vercel (UTC). El TTL de un link es una duracion,
  // no un dia calendario: debe ser identico en ambos.
  it('mantiene la duracion al cruzar el inicio del horario de verano chileno', () => {
    // DST 2026 en Chile: la madrugada del domingo 6 de septiembre (UTC-4 -> UTC-3).
    const from = new Date('2026-09-02T12:00:00.000Z');
    const expires = paymentLinkExpiresAt(from);

    // La ventana efectivamente cruza el cambio de offset...
    expect(santiagoWallClock(from)).toBe('08:00 GMT-4');
    expect(santiagoWallClock(expires)).toBe('09:00 GMT-3');

    // ...y aun asi el link vive 7 x 24h exactas.
    expect(expires.getTime() - from.getTime()).toBe(PAYMENT_LINK_TTL_MS);
    expect(expires.toISOString()).toBe('2026-09-09T12:00:00.000Z');
  });

  it('mantiene la duracion al cruzar el fin del horario de verano chileno', () => {
    // DST 2026 termina la madrugada del domingo 5 de abril (UTC-3 -> UTC-4).
    const from = new Date('2026-04-01T12:00:00.000Z');
    const expires = paymentLinkExpiresAt(from);

    expect(santiagoWallClock(from)).toBe('09:00 GMT-3');
    expect(santiagoWallClock(expires)).toBe('08:00 GMT-4');

    expect(expires.getTime() - from.getTime()).toBe(PAYMENT_LINK_TTL_MS);
    expect(expires.toISOString()).toBe('2026-04-08T12:00:00.000Z');
  });
});
