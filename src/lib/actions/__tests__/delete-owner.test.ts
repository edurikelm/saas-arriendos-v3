/**
 * `deleteUser`: eliminar un owner sin que la base lo rechace.
 *
 * Casi todas las FK hacia el owner son RESTRICT en producción. El borrado solo
 * funciona si toca cada tabla que cuelga de él, de las hojas a la raíz. La
 * versión anterior borraba cinco tablas y se quedó atrás a medida que se
 * sumaban notificaciones, tickets, calendarios externos y documentos: la base
 * rechazaba el borrado de cualquier owner real.
 *
 * Por eso el test principal no lista las tablas a mano. Lee `schema.prisma`,
 * calcula qué modelos bloquean el borrado del owner y exige que la transacción
 * los borre a todos, cada hijo antes que su padre. Un modelo nuevo con FK al
 * owner hace fallar este test hasta que `deleteUser` lo contemple.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Call = { model: string; op: string; args: unknown };

const mocks = vi.hoisted(() => {
  const calls: Call[] = [];
  const findUnique = vi.fn();
  const transaction = vi.fn(async (ops: unknown[]) => ops);
  const delegates = new Map<string, unknown>();

  // Cada `prisma.<modelo>.<op>(args)` queda registrado en orden, así el test
  // puede comprobar qué borra la transacción y en qué secuencia.
  const prisma = new Proxy({} as Record<string, unknown>, {
    get(_target, model) {
      if (typeof model !== "string") return undefined;
      if (model === "$transaction") return transaction;
      if (!delegates.has(model)) {
        delegates.set(
          model,
          new Proxy({} as Record<string, unknown>, {
            get(_d, op) {
              if (typeof op !== "string") return undefined;
              if (model === "userProfile" && op === "findUnique") return findUnique;
              return (args: unknown) => {
                const call = { model, op, args };
                calls.push(call);
                return call;
              };
            },
          }),
        );
      }
      return delegates.get(model);
    },
  });

  return { calls, findUnique, transaction, prisma, getSuperAdminSession: vi.fn() };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth/session", () => ({
  getSuperAdminSession: mocks.getSuperAdminSession,
  getSession: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/subscriptions/revalidate-plan", () => ({ revalidateAfterPlanChange: vi.fn() }));

import { deleteUser } from "../super-admin";

const adminSession = { userId: "admin-1", role: "SUPER_ADMIN", plan: "PRO", email: "admin@test.com" };
const owner = { email: "owner@test.com", role: "OWNER", subscription: null };

// ── Lectura del schema ──────────────────────────────────────────────────────

type Relation = { parent: string; optional: boolean; onDelete?: string };

function parseRelations(): Map<string, Relation[]> {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const models = new Map<string, Relation[]>();
  let current: string | null = null;

  for (const line of schema.split(/\r?\n/)) {
    const model = line.match(/^model (\w+) \{/);
    if (model) {
      current = model[1];
      models.set(current, []);
      continue;
    }
    if (line.startsWith("}")) {
      current = null;
      continue;
    }
    if (!current) continue;

    // Solo el lado que tiene la FK declara `fields:`.
    const relation = line.match(/^\s+\w+\s+(\w+)(\?)?\s+@relation\((.*)\)/);
    if (relation && relation[3].includes("fields:")) {
      models.get(current)!.push({
        parent: relation[1],
        optional: relation[2] === "?",
        onDelete: relation[3].match(/onDelete:\s*(\w+)/)?.[1],
      });
    }
  }
  return models;
}

/**
 * Una relación impide borrar al padre si no es Cascade ni SetNull. Una
 * relación opcional sin `onDelete` es SetNull por defecto en Prisma (así están
 * las `affected*` de SupportTicket en producción).
 */
function blocksParentDelete(relation: Relation): boolean {
  if (relation.onDelete === "Cascade" || relation.onDelete === "SetNull") return false;
  if (!relation.onDelete && relation.optional) return false;
  return true;
}

/**
 * Modelos que no se tocan al borrar un owner, con el motivo:
 * - Subscription / SubscriptionEvent: su existencia bloquea el borrado.
 * - AdminActionLog: solo apunta al ADMIN que actuó, y un owner nunca lo es.
 *   AdminNote también apunta al admin, pero entra por su FK al owner.
 */
const NOT_DELETED = new Set(["Subscription", "SubscriptionEvent", "AdminActionLog"]);

function modelsBlockingOwnerDelete(relations: Map<string, Relation[]>): Set<string> {
  const reached = new Set(["UserProfile"]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [model, rels] of relations) {
      if (reached.has(model) || NOT_DELETED.has(model)) continue;
      if (rels.some((r) => reached.has(r.parent) && blocksParentDelete(r))) {
        reached.add(model);
        grew = true;
      }
    }
  }
  return reached;
}

const delegateOf = (model: string) => model[0].toLowerCase() + model.slice(1);

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  mocks.calls.length = 0;
  vi.clearAllMocks();
  mocks.getSuperAdminSession.mockResolvedValue(adminSession);
  mocks.findUnique.mockResolvedValue(owner);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deleteUser: cobertura del schema", () => {
  it("el schema tiene los modelos que el cálculo espera (el parser no se rompió)", () => {
    const blocking = modelsBlockingOwnerDelete(parseRelations());

    // Muestras de cada nivel: si el parser dejara de leer relaciones, este
    // test cae antes que el de cobertura dé un verde vacío.
    for (const model of ["Property", "Reservation", "Payment", "Notification", "SupportMessageAttachment"]) {
      expect(blocking).toContain(model);
    }
    // Cascade desde el padre: no hace falta borrarlos a mano.
    expect(blocking).not.toContain("PasswordResetToken");
    expect(blocking).not.toContain("PropertyExportFeed");
  });

  it("borra cada modelo que bloquea el borrado del owner", async () => {
    const result = await deleteUser("owner-1", "owner@test.com");
    expect(result).toEqual({ success: true });

    const deleted = new Set(
      mocks.calls.filter((c) => c.op === "deleteMany" || c.op === "delete").map((c) => c.model),
    );
    const missing = [...modelsBlockingOwnerDelete(parseRelations())]
      .map(delegateOf)
      .filter((delegate) => !deleted.has(delegate));

    expect(
      missing,
      "Estos modelos tienen una FK hacia el owner (directa o indirecta) que la base " +
        "no borra sola. Agrégalos a la transacción de deleteUser, antes de su padre.",
    ).toEqual([]);
  });

  it("borra cada hijo antes que su padre", async () => {
    await deleteUser("owner-1", "owner@test.com");

    const order = new Map<string, number>();
    mocks.calls.forEach((c, i) => {
      if ((c.op === "deleteMany" || c.op === "delete") && !order.has(c.model)) order.set(c.model, i);
    });

    const relations = parseRelations();
    const blocking = modelsBlockingOwnerDelete(relations);
    const outOfOrder: string[] = [];
    for (const model of blocking) {
      for (const rel of relations.get(model) ?? []) {
        if (!blocking.has(rel.parent) || !blocksParentDelete(rel)) continue;
        const child = order.get(delegateOf(model));
        const parent = order.get(delegateOf(rel.parent));
        if (child === undefined || parent === undefined || child > parent) {
          outOfOrder.push(`${model} → ${rel.parent}`);
        }
      }
    }

    expect(outOfOrder).toEqual([]);
  });

  it("borra la integración de Mercado Pago aunque no tenga FK", async () => {
    await deleteUser("owner-1", "owner@test.com");

    expect(mocks.calls).toContainEqual(
      expect.objectContaining({ model: "userIntegration", op: "deleteMany", args: { where: { userId: "owner-1" } } }),
    );
  });

  it("deja registro OWNER_DELETED dentro de la misma transacción", async () => {
    await deleteUser("owner-1", "owner@test.com");

    const ops = mocks.transaction.mock.calls[0][0] as Call[];
    expect(ops.at(-1)).toMatchObject({
      model: "adminActionLog",
      op: "create",
      args: {
        data: {
          adminId: "admin-1",
          targetId: "owner-1",
          action: "OWNER_DELETED",
          details: JSON.stringify({ email: "owner@test.com" }),
        },
      },
    });
  });
});

describe("deleteUser: cuándo no borra", () => {
  const expectNothingDeleted = () => {
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.calls.filter((c) => c.op !== "findUnique")).toEqual([]);
  };

  it("un owner que tuvo suscripción, aunque ya no esté vigente", async () => {
    mocks.findUnique.mockResolvedValue({ ...owner, subscription: { id: "sub-1" } });

    const result = await deleteUser("owner-1", "owner@test.com");

    expect(result).toEqual({
      error: "Tuvo una suscripción PRO y ese es el registro de cobro: no se elimina. Usa «Cancelar cuenta».",
    });
    expectNothingDeleted();
  });

  it("un usuario que no es OWNER", async () => {
    mocks.findUnique.mockResolvedValue({ ...owner, role: "SUPER_ADMIN" });

    const result = await deleteUser("admin-2", "owner@test.com");

    expect(result).toEqual({ error: "Solo se pueden eliminar propietarios" });
    expectNothingDeleted();
  });

  it("con el email de confirmación equivocado", async () => {
    const result = await deleteUser("owner-1", "otro@test.com");

    expect(result).toEqual({ error: "Email de confirmación incorrecto" });
    expectNothingDeleted();
  });

  it("sin email de confirmación", async () => {
    const result = await deleteUser("owner-1");

    expect(result).toEqual({ error: "Se requiere confirmación por email para eliminar" });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expectNothingDeleted();
  });

  it("si el owner no existe", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const result = await deleteUser("nadie", "owner@test.com");

    expect(result).toEqual({ error: "Email de confirmación incorrecto" });
    expectNothingDeleted();
  });

  it("a uno mismo", async () => {
    const result = await deleteUser("admin-1", "admin@test.com");

    expect(result).toEqual({ error: "No puedes eliminarte a ti mismo" });
    expectNothingDeleted();
  });

  it("sin sesión de super admin", async () => {
    mocks.getSuperAdminSession.mockResolvedValue(null);

    const result = await deleteUser("owner-1", "owner@test.com");

    expect(result).toEqual({ error: "No autorizado" });
    expectNothingDeleted();
  });

  it("si la base rechaza la transacción, devuelve error en vez de lanzar", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("Foreign key constraint violated"));

    const result = await deleteUser("owner-1", "owner@test.com");

    expect(result).toEqual({ error: "No se pudo eliminar el propietario" });
  });
});
