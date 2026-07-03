/**
 * setup-env.mjs
 *
 * Crea `.env` desde `.env.example` si no existe.
 * Es seguro ejecutarlo varias veces: solo copia cuando `.env` falta.
 *
 * Pensado para correr antes de `prisma generate` en `postinstall`,
 * porque Prisma 7 exige `DATABASE_URL` al cargar `prisma.config.ts`
 * aunque `generate` no abra una conexión real a la DB.
 */
import { existsSync, copyFileSync } from "node:fs";

const envPath = ".env";
const examplePath = ".env.example";

if (existsSync(envPath)) {
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error(
    "[setup-env] No se encontró .env ni .env.example. Aborta para no dejar prisma generate sin DATABASE_URL."
  );
  process.exit(1);
}

copyFileSync(examplePath, envPath);
console.log(
  "[setup-env] .env creado desde .env.example. Reemplaza los valores placeholder antes de levantar la app."
);