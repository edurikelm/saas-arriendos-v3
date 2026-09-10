import { afterEach, describe, expect, it } from "vitest";
import { dateOnlyKey, localDateKey } from "@/lib/domain/timezone";

/**
 * `localDateKey` es para `Date` de date-picker (medianoche LOCAL del
 * navegador); `dateOnlyKey` es para campos date-only de la base (anclados a
 * 15:00/16:00 UTC). Confundirlas fue un bug real y latente — ver
 * `src/lib/domain/timezone.ts` para la tabla de mediciones completa.
 *
 * Corre secuencial en un solo archivo (no en paralelo entre archivos)
 * porque muta `process.env.TZ`, que es estado de proceso compartido. Se
 * restaura siempre en `afterEach` para no contaminar otros archivos de test
 * si vitest reutiliza el worker.
 */

const TIMEZONES = [
  "America/Santiago",
  "Europe/Madrid",
  "Asia/Tokyo",
  "Pacific/Kiritimati",
  "Pacific/Midway",
] as const;

// TZ cuyo offset es positivo respecto a Greenwich: ahí el slice UTC de un
// `Date` de picker aterriza en el día anterior.
const POSITIVE_OFFSET_TIMEZONES = new Set(["Europe/Madrid", "Asia/Tokyo", "Pacific/Kiritimati"]);

const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTz;
  }
});

describe.each(TIMEZONES)("localDateKey / dateOnlyKey en TZ=%s", (tz) => {
  it("localDateKey conserva el día que el usuario tocó en el picker", () => {
    process.env.TZ = tz;
    // react-day-picker entrega new Date(year, month, day): medianoche LOCAL.
    const pickerDate = new Date(2026, 8, 14); // 14-sep-2026
    expect(localDateKey(pickerDate)).toBe("2026-09-14");
  });

  it("documenta la regresión: slice UTC se equivoca un día en offsets positivos, localDateKey no", () => {
    process.env.TZ = tz;
    const pickerDate = new Date(2026, 8, 14);
    const sliceUtc = pickerDate.toISOString().split("T")[0];

    if (POSITIVE_OFFSET_TIMEZONES.has(tz)) {
      expect(sliceUtc).toBe("2026-09-13"); // el bug: un día antes de lo elegido
    } else {
      expect(sliceUtc).toBe("2026-09-14");
    }

    expect(localDateKey(pickerDate)).toBe("2026-09-14");
  });

  it("dateOnlyKey sigue devolviendo el día base (15:00/16:00 UTC) sin importar la TZ del proceso", () => {
    process.env.TZ = tz;
    // Forma base: campo date-only tal como llega de Reservation.startDate/endDate.
    const baseDate = new Date("2026-09-14T16:00:00Z");
    expect(dateOnlyKey(baseDate)).toBe("2026-09-14");
  });
});
