import { describe, it, expect, vi } from 'vitest';
import { mpFetch } from '../mp-fetch';

describe('mpFetch', () => {
  it('rejects with AbortError when timeout exceeded', async () => {
    const slowFetch = vi.fn(() => new Promise(resolve => setTimeout(() => resolve(new Response()), 200)));
    global.fetch = slowFetch as any;

    await expect(mpFetch('https://api.mercadopago.com/v1/payments/123', {}, 50))
      .rejects.toThrow(/aborted|abort/i);
  });

  it('resolves with response when fetch succeeds within timeout', async () => {
    const fastFetch = vi.fn(() => Promise.resolve(new Response('{}')));
    global.fetch = fastFetch as any;

    const response = await mpFetch('https://api.mercadopago.com/v1/payments/123', {}, 50);
    expect(response).toBeInstanceOf(Response);
    expect(fastFetch).toHaveBeenCalledTimes(1);
  });
});
