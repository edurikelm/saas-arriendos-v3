/**
 * Valida que NEXT_PUBLIC_APP_URL esté bien configurada.
 * Doc ADR-0001: no debe tener slash final.
 */
export interface AppUrlValidation {
  valid: boolean;
  reason?: string;
}

export function validateAppUrl(url: string | undefined): AppUrlValidation {
  if (!url) {
    return { valid: false, reason: 'NEXT_PUBLIC_APP_URL is required' };
  }

  if (url.endsWith('/')) {
    return { valid: false, reason: 'NEXT_PUBLIC_APP_URL must not end with /' };
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && url.startsWith('http://')) {
    return { valid: false, reason: 'NEXT_PUBLIC_APP_URL must use HTTPS in production' };
  }

  return { valid: true };
}
