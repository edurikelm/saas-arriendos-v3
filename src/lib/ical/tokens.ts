import { createHash, randomBytes } from "crypto";

/**
 * Generates a cryptographically secure export token.
 * Returns a base64url-encoded string of 32 bytes (~43 chars, charset [A-Za-z0-9_-]).
 */
export function generateExportToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hashes an export token using SHA-256 for storage.
 * Returns a base64url-encoded hash (44 chars).
 */
export function hashExportToken(raw: string): string {
  return createHash("sha256").update(raw).digest("base64url");
}

/**
 * Extracts the last 4 characters of a token for display purposes.
 */
export function getTokenLastFour(raw: string): string {
  return raw.slice(-4);
}

/**
 * Validates token format (base64url, 32-128 chars).
 */
export function isValidTokenFormat(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}
