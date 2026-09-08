import { describe, it, expect } from "vitest";
import { getInitials } from "../reservations-utils";

describe("getInitials", () => {
  // Regresión: la tabla desktop tenía su propia copia con
  // `part[part.length - 1]` (la ÚLTIMA letra de cada palabra), así que
  // "Carlos Rojas" salía "SS" y "Ana Soto" salía "AO", mientras la tarjeta
  // móvil mostraba las correctas. Probado contra las formas de nombre que
  // existen en producción (1 a 3 palabras).
  it.each([
    ["Ana Soto", "AS"],
    ["Carlos Rojas", "CR"],
    ["Pedro Lagos", "PL"],
    ["Javiera Nuñez", "JN"],
    ["Tomás Bravo", "TB"],
    ["María José Fernández Ruiz", "MJ"],
    ["Javiera", "J"],
  ])("%s → %s", (nombre, esperado) => {
    expect(getInitials(nombre)).toBe(esperado);
  });

  it("no toma la última letra de cada palabra", () => {
    expect(getInitials("Carlos Rojas")).not.toBe("SS");
    expect(getInitials("Ana Soto")).not.toBe("AO");
  });

  it("tolera espacios de más sin producir iniciales vacías", () => {
    expect(getInitials("  Ana   Soto  ")).toBe("AS");
  });
});
