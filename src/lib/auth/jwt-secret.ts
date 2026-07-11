/**
 * JWT_SECRET compartido por el seam de auth.
 *
 * Centralizado aquí para que `loginAction`/`registerAction` (en `actions/`)
 * y `getSession` (en `auth/session.ts`) firmen/verifiquen con el mismo
 * secreto sin duplicar la constante.
 */

export const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key"
);
