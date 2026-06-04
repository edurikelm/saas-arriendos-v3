import { prisma } from "@/lib/db/prisma";

export type EntityType = "reservation" | "payment" | "property";

export interface ChangeRecord {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ChangeRecorderMeta {
  userId: string;
  entityType: EntityType;
  entityId: string;
}

function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function diffObjects(
  original: Record<string, unknown>,
  updated: Record<string, unknown>
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];
  const allKeys = new Set([...Object.keys(original), ...Object.keys(updated)]);

  for (const key of allKeys) {
    const oldVal = original[key];
    const newVal = updated[key];

    if (oldVal === newVal) continue;

    if (
      oldVal instanceof Date &&
      newVal instanceof Date &&
      oldVal.getTime() === newVal.getTime()
    ) {
      continue;
    }

    const oldSerialized = serializeValue(oldVal);
    const newSerialized = serializeValue(newVal);

    if (oldSerialized !== newSerialized) {
      changes.push({
        field: key,
        oldValue: oldSerialized || null,
        newValue: newSerialized || null,
      });
    }
  }

  return changes;
}

export async function recordChanges(
  original: Record<string, unknown>,
  updated: Record<string, unknown>,
  meta: ChangeRecorderMeta
): Promise<ChangeRecord[]> {
  const changes = diffObjects(original, updated);

  if (changes.length === 0) return [];

  if (meta.entityType === "reservation") {
    await prisma.reservationChange.createMany({
      data: changes.map((change) => ({
        reservationId: meta.entityId,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
      })),
    });
  }

  return changes;
}

export function createChangeRecorder(meta: ChangeRecorderMeta) {
  return {
    record: (
      original: Record<string, unknown>,
      updated: Record<string, unknown>
    ) => recordChanges(original, updated, meta),
  };
}