import { describe, it, expect } from "vitest";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  getPasswordResetTokenLastFour,
  isValidPasswordResetTokenFormat,
} from "../password-reset-tokens";

describe("generatePasswordResetToken", () => {
  it("genera un token no nulo", () => {
    const token = generatePasswordResetToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
  });

  it("genera token con charset base64url (sin padding)", () => {
    const token = generatePasswordResetToken();
    // base64url charset: A-Za-z0-9_-
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("genera token de ~43 caracteres (32 bytes)", () => {
    const token = generatePasswordResetToken();
    expect(token.length).toBeGreaterThanOrEqual(42);
    expect(token.length).toBeLessThanOrEqual(44);
  });

  it("genera tokens únicos en 1000 iteraciones", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generatePasswordResetToken());
    }
    expect(tokens.size).toBe(1000);
  });
});

describe("hashPasswordResetToken", () => {
  it("retorna hash deterministic", () => {
    const token = "test-token-12345";
    const hash1 = hashPasswordResetToken(token);
    const hash2 = hashPasswordResetToken(token);
    expect(hash1).toBe(hash2);
  });

  it("retorna hash diferente para tokens diferentes", () => {
    const hash1 = hashPasswordResetToken("token-1");
    const hash2 = hashPasswordResetToken("token-2");
    expect(hash1).not.toBe(hash2);
  });

  it("retorna hash en formato base64url", () => {
    const hash = hashPasswordResetToken("any-token");
    expect(/^[A-Za-z0-9_-]+$/.test(hash)).toBe(true);
    expect(hash.length).toBeGreaterThanOrEqual(42);
    expect(hash.length).toBeLessThanOrEqual(44);
  });

  it("no revela el token original", () => {
    const token = "my-secret-token";
    const hash = hashPasswordResetToken(token);
    expect(hash).not.toContain(token);
  });
});

describe("getPasswordResetTokenLastFour", () => {
  it("retorna los últimos 4 caracteres", () => {
    expect(getPasswordResetTokenLastFour("abcdefghij")).toBe("ghij");
  });

  it("funciona con tokens base64url", () => {
    const token = "abc1234567890xyz_";
    expect(getPasswordResetTokenLastFour(token)).toBe("xyz_");
  });
});

describe("isValidPasswordResetTokenFormat", () => {
  it("acepta tokens válidos de 32+ caracteres", () => {
    expect(isValidPasswordResetTokenFormat("abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
  });

  it("acepta tokens base64url", () => {
    expect(isValidPasswordResetTokenFormat("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789__")).toBe(true);
  });

  it("rechaza tokens menores a 32 caracteres", () => {
    expect(isValidPasswordResetTokenFormat("abc123")).toBe(false);
  });

  it("rechaza caracteres inválidos", () => {
    expect(isValidPasswordResetTokenFormat("abc.def!ghi=jkl")).toBe(false);
  });

  it("rechaza tokens vacíos", () => {
    expect(isValidPasswordResetTokenFormat("")).toBe(false);
  });
});
