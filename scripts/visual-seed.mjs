#!/usr/bin/env node
/**
 * Seed representative reservations for visual QA.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "bcryptjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const envFile = resolve(root, ".env.local");
const envContent = readFileSync(envFile, "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = value;
}

const { PrismaClient } = await import("@prisma/client");
const { PrismaPg } = await import("@prisma/adapter-pg");
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function dateOnly(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

async function main() {
  const owner = await prisma.userProfile.findFirst({
    where: { role: "OWNER", status: "ACTIVE", email: { not: "eduardo@example.com" } },
    orderBy: { reservations: { _count: "desc" } },
  });
  if (!owner) throw new Error("No OWNER found — seed the DB first.");

  // Reset password to a known value so we can login for visual QA.
  const devPassword = await hash("visualseed123", 12);
  await prisma.userProfile.update({
    where: { id: owner.id },
    data: { password: devPassword },
  });

  await prisma.payment.deleteMany({ where: { reservation: { notes: { startsWith: "[visual-seed]" } } } });
  await prisma.reservation.deleteMany({ where: { notes: { startsWith: "[visual-seed]" } } });
  await prisma.reservationClient.deleteMany({ where: { notes: { startsWith: "[visual-seed]" } } });
  await prisma.property.deleteMany({ where: { name: { startsWith: "[visual-seed]" } } });

  const property = await prisma.property.create({
    data: {
      userId: owner.id,
      name: "[visual-seed] Depto Loft Lastarria",
      color: "#10b981",
      unitsAvailable: 3,
      dailyPrice: "85000",
      monthlyPrice: "850000",
      type: "APARTMENT",
      amenities: ["WiFi", "Cocina equipada", "Calefacción"],
      images: [],
    },
  });

  const client = await prisma.reservationClient.create({
    data: {
      userId: owner.id,
      name: "Camila Rojas",
      email: "camila.rojas@example.com",
      phone: "+56 9 8765 4321",
      rut: "12.345.678-9",
      notes: "[visual-seed]",
    },
  });

  const out = [];

  // 1. DAILY · partial paid
  {
    const startKey = todayKey(2);
    const endKey = todayKey(5);
    const res = await prisma.reservation.create({
      data: {
        userId: owner.id,
        propertyId: property.id,
        clientId: client.id,
        startDate: dateOnly(startKey),
        endDate: dateOnly(endKey),
        billingType: "DAILY",
        unitsBooked: 1,
        totalPrice: "255000",
        status: "CONFIRMED",
        bookingAirbnb: false,
        notes: "[visual-seed] DAILY con saldo parcial",
        payments: {
          create: [
            {
              paymentType: "RESERVATION",
              method: "MERCADO_PAGO",
              amount: "150000",
              status: "COMPLETED",
              paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
              installmentIndex: null,
            },
            {
              paymentType: "RESERVATION",
              method: "MERCADO_PAGO",
              amount: "105000",
              status: "PENDING",
              dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
              mercadoPagoId: "seed-pref-1",
              initPoint: "https://mp.example/checkout/seed-pref-1",
              expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
              installmentIndex: null,
            },
          ],
        },
      },
    });
    out.push({ id: res.id, label: "DAILY parcial con saldo pendiente MP" });
  }

  // 2. MONTHLY · 1 pagada, 1 vencida, 2 pendientes
  {
    const res = await prisma.reservation.create({
      data: {
        userId: owner.id,
        propertyId: property.id,
        clientId: client.id,
        startDate: dateOnly("2025-08-01"),
        endDate: dateOnly("2025-11-30"),
        billingType: "MONTHLY",
        unitsBooked: 1,
        totalPrice: "3400000",
        status: "CONFIRMED",
        bookingAirbnb: false,
        notes: "[visual-seed] MONTHLY con cuota vencida",
        payments: {
          create: [
            {
              paymentType: "RESERVATION",
              method: "TRANSFER",
              amount: "850000",
              status: "COMPLETED",
              paidAt: new Date("2025-08-02T10:00:00Z"),
              dueDate: dateOnly("2025-08-01"),
              installmentIndex: 1,
            },
            {
              paymentType: "RESERVATION",
              method: "MERCADO_PAGO",
              amount: "850000",
              status: "PENDING",
              dueDate: dateOnly("2025-09-01"),
              installmentIndex: 2,
            },
            {
              paymentType: "RESERVATION",
              method: "MERCADO_PAGO",
              amount: "850000",
              status: "PENDING",
              dueDate: dateOnly("2025-10-01"),
              installmentIndex: 3,
            },
            {
              paymentType: "RESERVATION",
              method: "MERCADO_PAGO",
              amount: "850000",
              status: "PENDING",
              dueDate: dateOnly("2025-11-01"),
              installmentIndex: 4,
            },
          ],
        },
      },
    });
    out.push({ id: res.id, label: "MONTHLY 1 pagada + 1 vencida + 2 pendientes" });
  }

  // 3. DAILY · fully paid
  {
    const startKey = todayKey(-10);
    const endKey = todayKey(-7);
    const res = await prisma.reservation.create({
      data: {
        userId: owner.id,
        propertyId: property.id,
        clientId: client.id,
        startDate: dateOnly(startKey),
        endDate: dateOnly(endKey),
        billingType: "DAILY",
        unitsBooked: 1,
        totalPrice: "255000",
        status: "COMPLETED",
        bookingAirbnb: true,
        notes: "[visual-seed] DAILY completamente pagado",
        payments: {
          create: [
            {
              paymentType: "RESERVATION",
              method: "MERCADO_PAGO",
              amount: "255000",
              status: "COMPLETED",
              paidAt: new Date(startKey + "T15:00:00Z"),
              installmentIndex: null,
            },
          ],
        },
      },
    });
    out.push({ id: res.id, label: "DAILY completamente pagado" });
  }

  // 4. DAILY · con cobros extra
  {
    const startKey = todayKey(-3);
    const endKey = todayKey(0);
    const res = await prisma.reservation.create({
      data: {
        userId: owner.id,
        propertyId: property.id,
        clientId: client.id,
        startDate: dateOnly(startKey),
        endDate: dateOnly(endKey),
        billingType: "DAILY",
        unitsBooked: 1,
        totalPrice: "340000",
        status: "CONFIRMED",
        bookingAirbnb: false,
        notes: "[visual-seed] DAILY con cobros extra",
        payments: {
          create: [
            {
              paymentType: "RESERVATION",
              method: "CASH",
              amount: "200000",
              status: "COMPLETED",
              paidAt: new Date(startKey + "T10:00:00Z"),
              installmentIndex: null,
            },
            {
              paymentType: "RESERVATION",
              method: "MERCADO_PAGO",
              amount: "140000",
              status: "PENDING",
              dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
              installmentIndex: null,
            },
            {
              paymentType: "EXTRA",
              method: "CASH",
              amount: "25000",
              status: "PENDING",
              title: "Limpieza profunda",
              description: "Cocina y horno",
              installmentIndex: null,
            },
            {
              paymentType: "EXTRA",
              method: "TRANSFER",
              amount: "15000",
              status: "COMPLETED",
              title: "Multa late check-out",
              paidAt: new Date(endKey + "T14:00:00Z"),
              installmentIndex: null,
            },
          ],
        },
      },
    });
    out.push({ id: res.id, label: "DAILY con cobros extra" });
  }

  console.log(JSON.stringify({ ownerEmail: owner.email, reservations: out }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());