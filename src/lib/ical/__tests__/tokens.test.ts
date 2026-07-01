import { describe, it, expect } from "vitest";
import { generateExportToken, hashExportToken, getTokenLastFour, isValidTokenFormat } from "../tokens";

describe("generateExportToken", () => {
  it("genera un token no nulo", () => {
    const token = generateExportToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
  });

  it("genera token con charset base64url (sin padding)", () => {
    const token = generateExportToken();
    // base64url charset: A-Za-z0-9_-
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("genera token de ~43 caracteres (32 bytes)", () => {
    const token = generateExportToken();
    expect(token.length).toBeGreaterThanOrEqual(42);
    expect(token.length).toBeLessThanOrEqual(44);
  });

  it("genera tokens únicos en 1000 iteraciones", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generateExportToken());
    }
    // With 32 bytes (256 bits), collision probability is negligible
    expect(tokens.size).toBe(1000);
  });
});

describe("hashExportToken", () => {
  it("retorna hash deterministic", () => {
    const token = "test-token-12345";
    const hash1 = hashExportToken(token);
    const hash2 = hashExportToken(token);
    expect(hash1).toBe(hash2);
  });

  it("retorna hash diferente para tokens diferentes", () => {
    const hash1 = hashExportToken("token-1");
    const hash2 = hashExportToken("token-2");
    expect(hash1).not.toBe(hash2);
  });

  it("retorna hash en formato base64url", () => {
    const hash = hashExportToken("any-token");
    expect(/^[A-Za-z0-9_-]+$/.test(hash)).toBe(true);
    // SHA-256 produces 32 bytes = ~44 chars in base64url
    expect(hash.length).toBeGreaterThanOrEqual(42);
    expect(hash.length).toBeLessThanOrEqual(44);
  });

  it("no revela el token original", () => {
    const token = "my-secret-token";
    const hash = hashExportToken(token);
    expect(hash).not.toContain(token);
  });
});

describe("getTokenLastFour", () => {
  it("retorna los últimos 4 caracteres", () => {
    expect(getTokenLastFour("abcdefghij")).toBe("ghij");
  });

  it("funciona con tokens base64url", () => {
    // Token ending with underscore
    const token = "abc1234567890xyz_";
    // Last 4 chars of "abc1234567890xyz_" are "xyz_"
    expect(getTokenLastFour(token)).toBe("xyz_");
  });
});

describe("isValidTokenFormat", () => {
  it("acepta tokens válidos de 32+ caracteres", () => {
    expect(isValidTokenFormat("abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
  });

  it("acepta tokens base64url", () => {
    expect(isValidTokenFormat("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789__")).toBe(true);
  });

  it("rechaza tokens menores a 32 caracteres", () => {
    expect(isValidTokenFormat("abc123")).toBe(false);
  });

  it("rechaza caracteres inválidos", () => {
    expect(isValidTokenFormat("abc.def!ghi=jkl")).toBe(false);
  });

  it("rechaza tokens vacíos", () => {
    expect(isValidTokenFormat("")).toBe(false);
  });
});
