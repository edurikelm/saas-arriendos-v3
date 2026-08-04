import { vi } from 'vitest';

export const prismaMock = {
  payment: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  userIntegration: {
    findMany: vi.fn(),
  },
  reservation: {
    findFirst: vi.fn(),
  },
  subscription: {
    findFirst: vi.fn(),
  },
};

export const getMercadoPagoTokenMock = vi.fn();
export const processMercadoPagoWebhookMock = vi.fn();
