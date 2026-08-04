import { createHmac } from 'crypto';

export function buildManifest(dataId: string, requestId: string, ts: string): string {
  return `id:${dataId};request-id:${requestId};ts:${ts};`;
}

export function computeSignature(secret: string, manifest: string): string {
  return createHmac('sha256', secret).update(manifest, 'utf-8').digest('hex');
}

export function buildSignedRequest(args: {
  secret: string;
  dataId: string;
  requestId?: string;
  ts?: string;
  url?: string;
  body?: string;
  method?: 'POST' | 'GET';
}): { request: Request; manifest: string; signature: string } {
  const requestId = args.requestId ?? 'request-abc';
  const ts = args.ts ?? String(Math.floor(Date.now() / 1000));
  const url = args.url ?? `https://example.com/api/webhooks/mercadopago?data.id=${args.dataId}&type=payment`;
  const body = args.body ?? '';
  const manifest = buildManifest(args.dataId, requestId, ts);
  const signature = computeSignature(args.secret, manifest);
  const headers = new Headers({ 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${signature}` });
  if (body) headers.set('content-type', 'application/json');
  return {
    request: new Request(url, { method: args.method ?? 'POST', headers, body }),
    manifest,
    signature,
  };
}
