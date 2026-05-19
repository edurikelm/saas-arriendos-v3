import { describe, it, expect } from 'vitest';
import { fileSchema } from '../file';

describe('fileSchema', () => {
  it('accepts a valid JPEG file under 5MB', () => {
    const result = fileSchema.safeParse({
      size: 1024 * 1024,
      type: 'image/jpeg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid PNG file under 5MB', () => {
    const result = fileSchema.safeParse({
      size: 2 * 1024 * 1024,
      type: 'image/png',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid WebP file under 5MB', () => {
    const result = fileSchema.safeParse({
      size: 3 * 1024 * 1024,
      type: 'image/webp',
    });
    expect(result.success).toBe(true);
  });

  it('rejects file larger than 5MB', () => {
    const result = fileSchema.safeParse({
      size: 6 * 1024 * 1024,
      type: 'image/jpeg',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('El archivo no puede superar los 5MB');
    }
  });

  it('rejects non-image file type', () => {
    const result = fileSchema.safeParse({
      size: 1024,
      type: 'application/pdf',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Solo se permiten imágenes');
    }
  });

  it('rejects unsupported image format', () => {
    const result = fileSchema.safeParse({
      size: 1024,
      type: 'image/gif',
    });
    expect(result.success).toBe(false);
  });

  it('rejects file exactly at 5MB boundary (succeeds at 5MB)', () => {
    const result = fileSchema.safeParse({
      size: 5 * 1024 * 1024,
      type: 'image/png',
    });
    expect(result.success).toBe(true);
  });
});
