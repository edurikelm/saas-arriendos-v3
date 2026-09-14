import { describe, expect, it } from "vitest";
import {
  agendaDayHeading,
  longDayTitle,
  monthName,
  relativeDayInline,
  shortDate,
} from "../day-labels";

// Lunes 14 de septiembre de 2026.
const TODAY = "2026-09-14";

describe("day-labels", () => {
  it("relativeDayInline: hoy, mañana y día de semana corto dentro del mes", () => {
    expect(relativeDayInline("2026-09-14", TODAY)).toBe("hoy");
    expect(relativeDayInline("2026-09-15", TODAY)).toBe("mañana");
    expect(relativeDayInline("2026-09-18", TODAY)).toBe("vie 18");
  });

  it("relativeDayInline agrega el mes cuando cambia", () => {
    expect(relativeDayInline("2026-10-01", TODAY)).toBe("jue 1 oct");
  });

  it("shortDate agrega el año solo si no es el de hoy", () => {
    expect(shortDate("2026-09-30", TODAY)).toBe("30 sept");
    expect(shortDate("2027-01-05", TODAY)).toMatch(/2027/);
  });

  it("agendaDayHeading: Hoy, Mañana, día largo, y mes cuando cambia", () => {
    expect(agendaDayHeading("2026-09-14", TODAY)).toBe("Hoy");
    expect(agendaDayHeading("2026-09-15", TODAY)).toBe("Mañana");
    expect(agendaDayHeading("2026-09-18", TODAY)).toBe("Viernes 18");
    expect(agendaDayHeading("2026-10-01", TODAY)).toBe("Jueves 1 de octubre");
  });

  it("longDayTitle y monthName", () => {
    expect(longDayTitle(TODAY)).toBe("Lunes 14 de septiembre");
    expect(monthName("2026-08")).toBe("agosto");
  });

  // Las claves se formatean como el día que nombran, sin reinterpretar zona:
  // un 1 de mes no puede leerse como el último día del mes anterior.
  it("no corre el día en el borde de mes", () => {
    expect(agendaDayHeading("2026-10-01", "2026-09-30")).toBe("Mañana");
    expect(longDayTitle("2026-10-01")).toBe("Jueves 1 de octubre");
  });
});
