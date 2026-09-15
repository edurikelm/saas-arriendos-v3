import { describe, expect, it } from "vitest";
import { formatCLPInput, parseCLPInput } from "../currency";

// `RegisterPaymentDialog` (@/components/dashboard/register-payment-dialog)
// usa este par para prellenar/parsear el monto editable: mismo comportamiento
// que los `formatCurrencyInput`/`parseCurrencyInput` locales de
// `AddPaymentDialog`, extraído acá para reutilizarlo sin tocar ese componente.

describe("formatCLPInput", () => {
  it("agrega separador de miles sin símbolo de moneda", () => {
    expect(formatCLPInput("500000")).toBe("500.000");
  });

  it("descarta caracteres no numéricos antes de formatear", () => {
    expect(formatCLPInput("50a0.000b")).toBe("500.000");
  });

  it("string vacío da string vacío, no '0'", () => {
    expect(formatCLPInput("")).toBe("");
  });

  it("una entrada sin dígitos da string vacío", () => {
    expect(formatCLPInput("abc")).toBe("");
  });
});

describe("parseCLPInput", () => {
  it("quita los separadores de miles", () => {
    expect(parseCLPInput("500.000")).toBe(500_000);
  });

  it("sin separadores devuelve el número tal cual", () => {
    expect(parseCLPInput("500")).toBe(500);
  });

  it("es la inversa exacta de formatCLPInput para enteros positivos", () => {
    const raw = 1_234_567;
    expect(parseCLPInput(formatCLPInput(String(raw)))).toBe(raw);
  });
});
