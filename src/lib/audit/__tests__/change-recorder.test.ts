import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordChanges, diffObjects, createChangeRecorder } from '../change-recorder';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    reservationChange: {
      createMany: vi.fn(),
    },
  },
}));

describe('diffObjects', () => {
  it('detects string field change', () => {
    const original = { status: 'PENDING' };
    const updated = { status: 'CONFIRMED' };

    const changes = diffObjects(original, updated);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'status',
      oldValue: 'PENDING',
      newValue: 'CONFIRMED',
    });
  });

  it('detects date field change', () => {
    const original = { startDate: new Date('2025-01-01') };
    const updated = { startDate: new Date('2025-01-15') };

    const changes = diffObjects(original, updated);

    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('startDate');
  });

  it('returns empty when no changes', () => {
    const original = { status: 'PENDING', name: 'Test' };
    const updated = { status: 'PENDING', name: 'Test' };

    const changes = diffObjects(original, updated);

    expect(changes).toHaveLength(0);
  });

  it('ignores equal Date objects', () => {
    const date = new Date('2025-01-01');
    const original = { startDate: date };
    const updated = { startDate: new Date(date.getTime()) };

    const changes = diffObjects(original, updated);

    expect(changes).toHaveLength(0);
  });

  it('detects added fields', () => {
    const original = { name: 'Test' };
    const updated = { name: 'Test', notes: 'New note' };

    const changes = diffObjects(original, updated);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'notes',
      oldValue: null,
      newValue: 'New note',
    });
  });

  it('detects removed fields', () => {
    const original = { name: 'Test', notes: 'Old note' };
    const updated = { name: 'Test' };

    const changes = diffObjects(original, updated);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'notes',
      oldValue: 'Old note',
      newValue: null,
    });
  });

  it('serializes nested objects', () => {
    const original = { metadata: { key: 'value1' } };
    const updated = { metadata: { key: 'value2' } };

    const changes = diffObjects(original, updated);

    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('metadata');
  });

  it('handles null values', () => {
    const original = { notes: null };
    const updated = { notes: 'New note' };

    const changes = diffObjects(original, updated);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'notes',
      oldValue: null,
      newValue: 'New note',
    });
  });

  it('handles numeric values', () => {
    const original = { unitsBooked: 1 };
    const updated = { unitsBooked: 3 };

    const changes = diffObjects(original, updated);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'unitsBooked',
      oldValue: '1',
      newValue: '3',
    });
  });

  it('handles boolean values', () => {
    const original = { bookingAirbnb: false };
    const updated = { bookingAirbnb: true };

    const changes = diffObjects(original, updated);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'bookingAirbnb',
      oldValue: 'false',
      newValue: 'true',
    });
  });
});

describe('createChangeRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a recorder with record method', () => {
    const meta = { userId: 'user-1', entityType: 'reservation' as const, entityId: 'res-1' };
    const recorder = createChangeRecorder(meta);

    expect(recorder).toHaveProperty('record');
    expect(typeof recorder.record).toBe('function');
  });

  it('record calls recordChanges with meta', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const meta = { userId: 'user-1', entityType: 'reservation' as const, entityId: 'res-1' };
    const recorder = createChangeRecorder(meta);

    const original = { status: 'PENDING' };
    const updated = { status: 'CONFIRMED' };

    await recorder.record(original, updated);

    expect(prisma.reservationChange.createMany).toHaveBeenCalledWith({
      data: [
        {
          reservationId: 'res-1',
          field: 'status',
          oldValue: 'PENDING',
          newValue: 'CONFIRMED',
        },
      ],
    });
  });

  it('record returns empty array when no changes', async () => {
    const meta = { userId: 'user-1', entityType: 'reservation' as const, entityId: 'res-1' };
    const recorder = createChangeRecorder(meta);

    const original = { status: 'PENDING' };
    const updated = { status: 'PENDING' };

    const result = await recorder.record(original, updated);

    expect(result).toHaveLength(0);
  });
});

describe('recordChanges', () => {
  it('creates change records in database for reservation entity', async () => {
    const { prisma } = await import('@/lib/db/prisma');

    const original = { status: 'PENDING', notes: 'Original' };
    const updated = { status: 'CONFIRMED', notes: 'Updated' };
    const meta = { userId: 'user-1', entityType: 'reservation' as const, entityId: 'res-1' };

    await recordChanges(original, updated, meta);

    expect(prisma.reservationChange.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ reservationId: 'res-1', field: 'status' }),
        expect.objectContaining({ reservationId: 'res-1', field: 'notes' }),
      ]),
    });
  });
});