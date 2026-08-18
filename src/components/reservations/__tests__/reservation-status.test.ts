import { describe, expect, it } from "vitest";
import {
  daysUntilEnd,
  daysUntilStart,
  formatRelativeDay,
  getNights,
  getReservationTone,
  getTemporalStatus,
  labelDaysUntilEnd,
  labelDaysUntilStart,
} from "../reservation-status";

// "Hoy" en wall-time America/Santiago (UTC-4 en invierno, UTC-3 en verano).
// Fijamos `now` a mediodía UTC del 2026-08-11 = 08:00 SCL del 2026-08-11 (invierno, UTC-4).
const NOW_SCL_2026_08_11_MORNING = new Date("2026-08-11T12:00:00.000Z");

describe("getTemporalStatus — bug regresión #1: start_date = hoy NO es 'Próxima'", () => {
  it("DAILY: reserva que inicia hoy (UTC midnight del backend) → 'Activa'", () => {
    // El backend serializa start_date como "2026-08-11T00:00:00.000Z" (UTC midnight).
    // Antes del fix, la comparación `today < start` se cumplía en timezones UTC+ y
    // mostraba 'Próxima En 1 días'. Ahora debe ser 'Activa'.
    // Estancia 11 ago → 12 ago son 2 noches per convención 'Última Noche'.
    const result = getTemporalStatus(
      "2026-08-11T00:00:00.000Z",
      "2026-08-12T00:00:00.000Z",
      "DAILY",
      "CONFIRMED",
      NOW_SCL_2026_08_11_MORNING,
    );
    expect(result.label).toBe("Activa");
    expect(result.sublabel).toMatch(/2 noches/i);
  });

  it("DAILY: reserva que inicia y termina hoy (start = end = hoy) → 'Activa' 1 noche", () => {
    // Caso límite: start = end = hoy. Per CONTEXT.md ("Última Noche":
    // end_date representa la última noche que duerme el huésped), el cálculo
    // de noches es (end - start + 1) = 1. No es 0.
    const result = getTemporalStatus(
      "2026-08-11T00:00:00.000Z",
      "2026-08-11T00:00:00.000Z",
      "DAILY",
      "PENDING",
      NOW_SCL_2026_08_11_MORNING,
    );
    expect(result.label).toBe("Activa");
    expect(result.sublabel).toMatch(/1 noche/i);
  });

  it("MONTHLY: reserva que inicia este mes → 'Activa'", () => {
    const result = getTemporalStatus(
      "2026-08-11T00:00:00.000Z",
      "2026-11-30T00:00:00.000Z",
      "MONTHLY",
      "CONFIRMED",
      NOW_SCL_2026_08_11_MORNING,
    );
    expect(result.label).toBe("Activa");
    expect(result.sublabel).toMatch(/mes/i);
  });
});

describe("getTemporalStatus — bug regresión #2: noches restantes respetan convención 'Última Noche'", () => {
  // Bug reportado por el usuario: reserva del 11 al 15 ago mostraba
  // "ACTIVA · 4 noches" en la columna Estado, pero "5 NOCHES" en la columna
  // Estancia. La discrepancia venía de que `nightsRemaining` no sumaba +1.
  //
  // CONTEXT.md: "Última Noche — end_date representa la última noche que
  // duerme el huésped, no el día de check-out. El cálculo de noches es
  // (end_date - start_date + 1)".
  //
  // Por lo tanto, noches restantes = (end_date - hoy + 1) cuando hoy ∈ [start, end].
  // Si hoy = end, queda 1 noche (la última). Si hoy = start, queda (end - start + 1).

  it("hoy = start_date, end = 5 días después → 'Activa · 5 noches' (caso exacto del bug)", () => {
    // Reserva 11 ago → 15 ago, hoy = 11 ago. 5 noches totales (11, 12, 13, 14, 15).
    const result = getTemporalStatus(
      "2026-08-11T00:00:00.000Z",
      "2026-08-15T00:00:00.000Z",
      "DAILY",
      "CONFIRMED",
      NOW_SCL_2026_08_11_MORNING, // 2026-08-11 SCL
    );
    expect(result.label).toBe("Activa");
    expect(result.sublabel).toBe("5 noches");
  });

  it("hoy en día intermedio (12 ago) → quedan 4 noches", () => {
    const now = new Date("2026-08-12T12:00:00.000Z"); // 12 ago SCL
    const result = getTemporalStatus(
      "2026-08-11T00:00:00.000Z",
      "2026-08-15T00:00:00.000Z",
      "DAILY",
      "CONFIRMED",
      now,
    );
    expect(result.label).toBe("Activa");
    expect(result.sublabel).toBe("4 noches");
  });

  it("hoy = end_date → queda 1 noche (la última, per 'Última Noche')", () => {
    const now = new Date("2026-08-15T12:00:00.000Z"); // 15 ago SCL
    const result = getTemporalStatus(
      "2026-08-11T00:00:00.000Z",
      "2026-08-15T00:00:00.000Z",
      "DAILY",
      "CONFIRMED",
      now,
    );
    expect(result.label).toBe("Activa");
    expect(result.sublabel).toBe("1 noche"); // singular
  });
});

describe("getTemporalStatus — bug regresión #2: sublabel humano para futuro cercano", () => {
  it("start mañana → 'Próxima' con sublabel 'Mañana'", () => {
    const result = getTemporalStatus(
      "2026-08-12T00:00:00.000Z",
      "2026-08-13T00:00:00.000Z",
      "DAILY",
      "CONFIRMED",
      NOW_SCL_2026_08_11_MORNING,
    );
    expect(result.label).toBe("Próxima");
    expect(result.sublabel).toBe("Mañana");
  });

  it("start en 2 días → 'Próxima' con sublabel 'Pasado mañana'", () => {
    const result = getTemporalStatus(
      "2026-08-13T00:00:00.000Z",
      "2026-08-14T00:00:00.000Z",
      "DAILY",
      "CONFIRMED",
      NOW_SCL_2026_08_11_MORNING,
    );
    expect(result.label).toBe("Próxima");
    expect(result.sublabel).toBe("Pasado mañana");
  });

  it("start en 5 días → 'Próxima' con sublabel 'En 5 días'", () => {
    const result = getTemporalStatus(
      "2026-08-16T00:00:00.000Z",
      "2026-08-17T00:00:00.000Z",
      "DAILY",
      "CONFIRMED",
      NOW_SCL_2026_08_11_MORNING,
    );
    expect(result.label).toBe("Próxima");
    expect(result.sublabel).toBe("En 5 días");
  });

  it("start en 1 día (singular) usa singular", () => {
    const result = getTemporalStatus(
      "2026-08-12T00:00:00.000Z",
      "2026-08-12T00:00:00.000Z",
      "DAILY",
      "PENDING",
      NOW_SCL_2026_08_11_MORNING,
    );
    expect(result.sublabel).toBe("Mañana");
  });
});

describe("getTemporalStatus — estados terminales y pasados", () => {
  it("status === CANCELLED → 'Cancelada' sin importar fechas", () => {
    const result = getTemporalStatus(
      "2026-08-11T00:00:00.000Z",
      "2026-08-12T00:00:00.000Z",
      "DAILY",
      "CANCELLED",
      NOW_SCL_2026_08_11_MORNING,
    );
    expect(result.label).toBe("Cancelada");
    expect(result.sublabel).toBeUndefined();
  });

  it("status === COMPLETED → 'Finalizada' sin importar fechas", () => {
    const result = getTemporalStatus(
      "2026-08-11T00:00:00.000Z",
      "2026-08-12T00:00:00.000Z",
      "DAILY",
      "COMPLETED",
      NOW_SCL_2026_08_11_MORNING,
    );
    expect(result.label).toBe("Finalizada");
  });

  it("endDate ayer, status CONFIRMED → 'Finalizada'", () => {
    const result = getTemporalStatus(
      "2026-08-09T00:00:00.000Z",
      "2026-08-10T00:00:00.000Z",
      "DAILY",
      "CONFIRMED",
      NOW_SCL_2026_08_11_MORNING,
    );
    expect(result.label).toBe("Finalizada");
  });
});

describe("getTemporalStatus — invariante de timezone (reproduce el bug exacto)", () => {
  it("bug exacto reportado: reserva creada el 2026-08-11 NO es 'Próxima' bajo ningún now razonable", () => {
    // Simulamos tres `now` distintos en distintos puntos del 2026-08-11.
    // Mientras now siga siendo wall-time 2026-08-11 en Santiago, start = hoy.
    const candidates = [
      new Date("2026-08-11T00:00:00.000Z"), // 2026-08-10 20:00 SCL (sigue siendo 10 ago en SCL)
      new Date("2026-08-11T04:00:00.000Z"), // 2026-08-11 00:00 SCL (medianoche SCL)
      new Date("2026-08-11T12:00:00.000Z"), // 2026-08-11 08:00 SCL (mañana)
      new Date("2026-08-11T20:00:00.000Z"), // 2026-08-11 16:00 SCL (tarde)
    ];

    for (const now of candidates) {
      const result = getTemporalStatus(
        "2026-08-11T00:00:00.000Z",
        "2026-08-12T00:00:00.000Z",
        "DAILY",
        "CONFIRMED",
        now,
      );
      // Solo verificamos que no caiga en "Próxima" cuando hoy es 11 ago en SCL.
      // El primer caso (00:00 UTC) cae en 10 ago en SCL, así que SÍ puede ser
      // "Próxima". Lo aceptamos; el resto debe ser "Activa".
      if (result.label === "Próxima") {
        expect(now.toISOString()).toBe("2026-08-11T00:00:00.000Z");
      } else {
        expect(result.label).toBe("Activa");
      }
    }
  });
});

describe("getReservationTone", () => {
  it("status CANCELLED → destructive", () => {
    expect(
      getReservationTone("CANCELLED", "2026-08-11T00:00:00.000Z", "2026-08-12T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING),
    ).toBe("destructive");
  });

  it("status COMPLETED → neutral", () => {
    expect(
      getReservationTone("COMPLETED", "2026-08-11T00:00:00.000Z", "2026-08-12T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING),
    ).toBe("neutral");
  });

  it("active (hoy ∈ [start, end]) → success", () => {
    expect(
      getReservationTone("CONFIRMED", "2026-08-11T00:00:00.000Z", "2026-08-12T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING),
    ).toBe("success");
  });

  it("upcoming (start mañana) → info", () => {
    expect(
      getReservationTone("CONFIRMED", "2026-08-12T00:00:00.000Z", "2026-08-13T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING),
    ).toBe("info");
  });

  it("past (end ayer) → neutral", () => {
    expect(
      getReservationTone("CONFIRMED", "2026-08-09T00:00:00.000Z", "2026-08-10T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING),
    ).toBe("neutral");
  });
});

describe("formatRelativeDay", () => {
  it("hoy → 'Hoy'", () => {
    expect(formatRelativeDay("2026-08-11T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Hoy");
  });

  it("ayer → 'Ayer'", () => {
    expect(formatRelativeDay("2026-08-10T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Ayer");
  });

  it("hace 3 días → 'Hace 3 días'", () => {
    expect(formatRelativeDay("2026-08-08T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Hace 3 días");
  });

  it("hace 10 días → 'Hace 1 sem'", () => {
    expect(formatRelativeDay("2026-08-01T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Hace 1 sem");
  });

  it("hace 60 días → 'Hace 2 meses'", () => {
    expect(formatRelativeDay("2026-06-12T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Hace 2 meses");
  });

  it("mañana → 'Mañana'", () => {
    expect(formatRelativeDay("2026-08-12T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Mañana");
  });

  it("en 3 días → 'En 3 días'", () => {
    expect(formatRelativeDay("2026-08-14T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("En 3 días");
  });
});

describe("daysUntilStart / daysUntilEnd — helpers del Dashboard", () => {
  it("daysUntilStart: hoy → 0", () => {
    expect(daysUntilStart("2026-08-11T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe(0);
  });

  it("daysUntilStart: mañana → 1", () => {
    expect(daysUntilStart("2026-08-12T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe(1);
  });

  it("daysUntilStart: ayer → -1", () => {
    expect(daysUntilStart("2026-08-10T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe(-1);
  });

  it("daysUntilStart: invariante de timezone (UTC midnight del backend NO se reinterpreta)", () => {
    // Para el caso exacto del bug: en zona UTC+1 el patrón previo retornaba 1.
    // Ahora daysUntilStart sobre UTC midnight del día objetivo retorna 0 si
    // wall-time SCL coincide con ese día calendario.
    expect(daysUntilStart("2026-08-11T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe(0);
  });

  it("daysUntilEnd: hoy → 0 (última noche en curso)", () => {
    expect(daysUntilEnd("2026-08-11T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe(0);
  });

  it("daysUntilEnd: mañana → 1", () => {
    expect(daysUntilEnd("2026-08-12T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe(1);
  });

  it("daysUntilEnd: ayer → -1", () => {
    expect(daysUntilEnd("2026-08-10T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe(-1);
  });
});

describe("labelDaysUntilStart — copy humano para 'Llega en ...'", () => {
  // Bug del Dashboard: el código previo usaba `Math.ceil((new Date(s) - today) / día)`
  // que en zonas UTC+ retornaba "Llega en 1 día" para reservas con start_date = hoy.
  // Estos tests bloquean la regresión del copy crudo.

  it("start = hoy → 'Hoy' (no 'En 0 días')", () => {
    expect(labelDaysUntilStart("2026-08-11T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Hoy");
  });

  it("start = mañana → 'Mañana'", () => {
    expect(labelDaysUntilStart("2026-08-12T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Mañana");
  });

  it("start en 2 días → 'Pasado mañana'", () => {
    expect(labelDaysUntilStart("2026-08-13T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Pasado mañana");
  });

  it("start en 3 días → 'En 3 días'", () => {
    expect(labelDaysUntilStart("2026-08-14T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("En 3 días");
  });

  it("start en 1 día (singular) usa singular", () => {
    expect(labelDaysUntilStart("2026-08-12T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Mañana");
  });
});

describe("labelDaysUntilEnd — copy humano para 'Finaliza en ...'", () => {
  it("end = hoy → 'Hoy' (última noche en curso)", () => {
    expect(labelDaysUntilEnd("2026-08-11T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Hoy");
  });

  it("end = mañana → 'Mañana'", () => {
    expect(labelDaysUntilEnd("2026-08-12T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Mañana");
  });

  it("end en 3 días → 'En 3 días'", () => {
    expect(labelDaysUntilEnd("2026-08-14T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("En 3 días");
  });

  it("end ayer → 'Ayer'", () => {
    expect(labelDaysUntilEnd("2026-08-10T00:00:00.000Z", NOW_SCL_2026_08_11_MORNING)).toBe("Ayer");
  });
});

describe("getNights — duración total de la estancia (regresión bug Dashboard)", () => {
  it("11 ago → 15 ago = 5 noches (convención 'Última Noche')", () => {
    expect(getNights("2026-08-11T00:00:00.000Z", "2026-08-15T00:00:00.000Z")).toBe(5);
  });

  it("13 ago → 16 ago = 4 noches", () => {
    expect(getNights("2026-08-13T00:00:00.000Z", "2026-08-16T00:00:00.000Z")).toBe(4);
  });

  it("start = end = mismo día = 1 noche", () => {
    expect(getNights("2026-08-11T00:00:00.000Z", "2026-08-11T00:00:00.000Z")).toBe(1);
  });

  it("end anterior a start (input inválido) → fallback a 1 noche", () => {
    // No debería ocurrir en datos válidos, pero el seam es defensivo.
    expect(getNights("2026-08-15T00:00:00.000Z", "2026-08-11T00:00:00.000Z")).toBe(1);
  });

  it("acepta strings date-only sin componente horario", () => {
    expect(getNights("2026-08-11", "2026-08-15")).toBe(5);
  });

  it("acepta inputs Date (timezone-safe)", () => {
    // Caso de uso del receipt-pdf.tsx: startDate/endDate son Date.
    // Antes: `Math.ceil((end - start) / día) + 1` con `new Date(string)` (UTC midnight).
    // Ahora: el seam extrae dateKey en SCL, sin importar la zona del proceso.
    const start = new Date("2026-08-11T00:00:00.000Z"); // UTC midnight
    const end = new Date("2026-08-15T00:00:00.000Z"); // UTC midnight
    expect(getNights(start, end)).toBe(5);
  });

  it("Date con hora arbitraria se interpreta por día calendario en SCL", () => {
    // 2026-08-11T23:30:00 UTC = 2026-08-11T19:30:00 SCL (UTC-4) → día 11 ago.
    // 2026-08-15T12:00:00 UTC = 2026-08-15T08:00:00 SCL → día 15 ago.
    // Total: 15 - 11 + 1 = 5 noches.
    const start = new Date("2026-08-11T23:30:00.000Z");
    const end = new Date("2026-08-15T12:00:00.000Z");
    expect(getNights(start, end)).toBe(5);
  });
});
