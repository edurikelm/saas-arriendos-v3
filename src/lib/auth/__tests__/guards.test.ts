import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/session', () => ({
  getSession: mockGetSession,
}));

// redirect() from next/navigation throws an error to interrupt flow.
// We mock it to throw a recognizable error so we can assert on call arguments.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`Redirected to ${url}`);
    (err as any).url = url;
    throw err;
  }),
}));

vi.mock('@/lib/auth/role-routes', () => ({
  isSuperAdmin: (role: string | null | undefined) => role === 'SUPER_ADMIN',
}));

import { requireAuth, requireOwner, requireSuperAdmin } from '../guards';

const ownerSession: SessionUser = {
  userId: 'user-1',
  role: 'OWNER',
  plan: 'PRO',
  email: 'test@test.com',
};

const adminSession: SessionUser = {
  userId: 'admin-1',
  role: 'SUPER_ADMIN',
  plan: 'PRO',
  email: 'admin@test.com',
};

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin sesión → redirect a /login', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow('Redirected to /login');
    const { redirect } = await import('next/navigation');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('con sesión → retorna session', async () => {
    mockGetSession.mockResolvedValue(ownerSession);

    const result = await requireAuth();

    expect(result).toEqual(ownerSession);
    const { redirect } = await import('next/navigation');
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('requireOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin sesión → redirect a /login', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(requireOwner()).rejects.toThrow('Redirected to /login');
    const { redirect } = await import('next/navigation');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('con SUPER_ADMIN → redirect a /admin', async () => {
    mockGetSession.mockResolvedValue(adminSession);

    await expect(requireOwner()).rejects.toThrow('Redirected to /admin');
    const { redirect } = await import('next/navigation');
    expect(redirect).toHaveBeenCalledWith('/admin');
  });

  it('con OWNER → retorna session', async () => {
    mockGetSession.mockResolvedValue(ownerSession);

    const result = await requireOwner();

    expect(result).toEqual(ownerSession);
    const { redirect } = await import('next/navigation');
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('requireSuperAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin sesión → redirect a /login', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(requireSuperAdmin()).rejects.toThrow('Redirected to /login');
    const { redirect } = await import('next/navigation');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('con OWNER → redirect a /dashboard', async () => {
    mockGetSession.mockResolvedValue(ownerSession);

    await expect(requireSuperAdmin()).rejects.toThrow('Redirected to /dashboard');
    const { redirect } = await import('next/navigation');
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('con SUPER_ADMIN → retorna session', async () => {
    mockGetSession.mockResolvedValue(adminSession);

    const result = await requireSuperAdmin();

    expect(result).toEqual(adminSession);
    const { redirect } = await import('next/navigation');
    expect(redirect).not.toHaveBeenCalled();
  });
});
