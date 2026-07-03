import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Use DIRECT_URL (pooler session mode, port 5432) for migrations/db push.
  // DATABASE_URL (pooler transaction mode, port 6543) is reserved for runtime
  // queries via src/lib/db/prisma.ts — transaction mode breaks introspection
  // and DDL transactions.
  datasource: {
    url: env("DIRECT_URL"),
  },
});