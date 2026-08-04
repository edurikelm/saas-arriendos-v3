import { describe, it, expect, vi } from 'vitest';
import { validateAppUrl } from '../env-validation';

describe('validateAppUrl', () => {
  it('rejects URL with trailing slash', () => {
    expect(validateAppUrl('https://app.com/').valid).toBe(false);
  });

  it('accepts HTTPS URL without trailing slash', () => {
    expect(validateAppUrl('https://app.com').valid).toBe(true);
  });

  it('accepts HTTP localhost in dev', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(validateAppUrl('http://localhost:3000').valid).toBe(true);
  });

  it('rejects undefined URL', () => {
    expect(validateAppUrl(undefined).valid).toBe(false);
  });

  it('rejects HTTP in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(validateAppUrl('http://app.com').valid).toBe(false);
  });
});
