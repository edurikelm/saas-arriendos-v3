import { createHash, randomBytes } from "crypto";

/**
 * Generates a cryptographically secure password reset token.
 * Returns a base64url-encoded string of 32 bytes (~43 chars, charset [A-Za-z0-9_-]).
 *
 * The raw token is shown ONCE (in the reset email) and never persisted.
 * Only the SHA-256 hash is stored in the database.
 */
export function generatePasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hashes a password reset token using SHA-256 for storage.
 * Returns a base64url-encoded hash (44 chars).
 *
 * Same pattern as the iCal export feed token hashing (see src/lib/ical/tokens.ts).
 */
export function hashPasswordResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("base64url");
}

/**
 * Extracts the last 4 characters of a token for display purposes.
 * Currently unused for password reset (we don't show partial tokens in UI)
 * but kept consistent with iCal export tokens for debug/support flows.
 */
export function getPasswordResetTokenLastFour(raw: string): string {
  return raw.slice(-4);
}

/**
 * Validates token format (base64url, 32-128 chars).
 * Used to reject malformed tokens early before hitting the database.
 */
export function isValidPasswordResetTokenFormat(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}
