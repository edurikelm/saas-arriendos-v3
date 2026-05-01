import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const poolConfig: pg.PoolConfig = {
  connectionString,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
};

if (connectionString.includes("sslmode=verify-ca") || connectionString.includes("sslmode=require")) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new pg.Pool(poolConfig);
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["error"],
});

async function main() {
  const hashedPassword = await hash("admin123", 12);

  const superAdmin = await prisma.userProfile.upsert({
    where: { email: "eduardo@example.com" },
    update: {},
    create: {
      name: "Eduardo",
      email: "eduardo@example.com",
      password: hashedPassword,
      role: "SUPER_ADMIN",
      plan: null,
    },
  });

  console.log("Super Admin created:", superAdmin.email);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());