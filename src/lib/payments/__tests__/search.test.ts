import { describe, it, expect } from "vitest";
import { parseAmountQuery } from "../search";

describe("parseAmountQuery", () => {
  it("acepta el monto tal como se escribe sin formato", () => {
    expect(parseAmountQuery("450000")).toBe(450000);
  });

  it("acepta el monto tal como aparece en pantalla", () => {
    // El punto es separador de MILES en es-CL, no decimal: 450.000 es
    // cuatrocientos cincuenta mil. Interpretarlo como decimal daría 450.
    expect(parseAmountQuery("450.000")).toBe(450000);
    expect(parseAmountQuery("$450.000")).toBe(450000);
  });

  it("ignora espacios alrededor", () => {
    expect(parseAmountQuery("  85000 ")).toBe(85000);
  });

  it("devuelve null cuando no hay ningún dígito", () => {
    // Una búsqueda por nombre no debe arrastrar una cláusula de monto que
    // nunca va a calzar.
    expect(parseAmountQuery("María Fernanda")).toBeNull();
    expect(parseAmountQuery("")).toBeNull();
    expect(parseAmountQuery("   ")).toBeNull();
  });

  it("devuelve null sobre el entero seguro de JavaScript", () => {
    // Comparar contra un valor ya redondeado daría un resultado plausible y
    // equivocado.
    expect(parseAmountQuery("9".repeat(20))).toBeNull();
  });

  it("rescata los dígitos de un texto mixto", () => {
    // No es la búsqueda típica, pero el resultado tiene que ser predecible:
    // el monto se suma como una cláusula más del OR, así que a lo sumo no
    // calza con nada.
    expect(parseAmountQuery("abc 123")).toBe(123);
  });
});
