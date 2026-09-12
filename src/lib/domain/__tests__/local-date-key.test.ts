import { afterEach, describe, expect, it } from "vitest";
import { dateOnlyKey, localDateFromKey, localDateKey } from "@/lib/domain/timezone";

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

// TZ con offset NEGATIVO respecto a Greenwich: ahí `new Date("YYYY-MM-DD")`,
// que el estándar interpreta en UTC, se dibuja en el día ANTERIOR.
const NEGATIVE_OFFSET_TIMEZONES = new Set(["America/Santiago", "Pacific/Midway"]);

describe.each(TIMEZONES)("localDateFromKey en TZ=%s", (tz) => {
  it("devuelve el mismo día que la clave nombra", () => {
    process.env.TZ = tz;
    const d = localDateFromKey("2026-09-01");

    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(1);
  });

  it("documenta la regresión: new Date(clave) se corre un día en offsets negativos", () => {
    process.env.TZ = tz;
    const conStandard = new Date("2026-09-01");

    if (NEGATIVE_OFFSET_TIMEZONES.has(tz)) {
      // El bug que vio el usuario: elegía el 1 y el calendario marcaba el 31.
      expect(conStandard.getDate()).toBe(31);
      expect(conStandard.getMonth()).toBe(7);
    } else {
      expect(conStandard.getDate()).toBe(1);
    }

    expect(localDateFromKey("2026-09-01").getDate()).toBe(1);
  });

  it("es el inverso exacto de localDateKey: la ida y vuelta no mueve el día", () => {
    process.env.TZ = tz;

    for (const clave of ["2026-01-01", "2026-06-15", "2026-09-01", "2026-12-31"]) {
      expect(localDateKey(localDateFromKey(clave))).toBe(clave);
    }
  });

  it("la ida y vuelta REPETIDA tampoco lo mueve", () => {
    // El daño real del bug era acumulativo: con `new Date(clave)`, reaplicar el
    // rango lo retrocedía un día CADA vez. Medido en Santiago, el 1 de
    // septiembre se volvía 28 de agosto tras cuatro aperturas del picker.
    process.env.TZ = tz;

    let clave = "2026-09-01";
    for (let i = 0; i < 4; i++) {
      clave = localDateKey(localDateFromKey(clave));
    }

    expect(clave).toBe("2026-09-01");
  });

  it("sobrevive a un cambio de hora", () => {
    // En Chile el horario de verano arranca el primer domingo de septiembre:
    // ese día la medianoche local NO existe. `new Date(y, m, d)` normaliza a la
    // primera hora válida, que sigue siendo el mismo día calendario.
    process.env.TZ = tz;

    for (const clave of ["2026-09-06", "2026-09-07", "2027-04-04"]) {
      expect(localDateKey(localDateFromKey(clave))).toBe(clave);
    }
  });
});
