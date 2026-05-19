import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUploadStream = vi.fn();
const mockDestroy = vi.fn();

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload_stream: mockUploadStream,
      destroy: mockDestroy,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('uploadImage - folder parameter', () => {
  it('uses default folder when no folder param is provided', async () => {
    mockUploadStream.mockImplementation((_options: any, callback: any) => {
      callback(null, { secure_url: 'https://res.cloudinary.com/test.jpg' });
      return { end: vi.fn() };
    });

    const { uploadImage } = await import('../cloudinary');
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const result = await uploadImage(file);

    expect(result).toBe('https://res.cloudinary.com/test.jpg');
    expect(mockUploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'rentalpro/properties' }),
      expect.any(Function)
    );
  });

  it('uses provided folder when folder param is given', async () => {
    mockUploadStream.mockImplementation((_options: any, callback: any) => {
      callback(null, { secure_url: 'https://res.cloudinary.com/test.jpg' });
      return { end: vi.fn() };
    });

    const { uploadImage } = await import('../cloudinary');
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const result = await uploadImage(file, 'rentalpro/receipts');

    expect(result).toBe('https://res.cloudinary.com/test.jpg');
    expect(mockUploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'rentalpro/receipts' }),
      expect.any(Function)
    );
  });
});

describe('deleteImage', () => {
  it('extracts public ID and calls destroy', async () => {
    mockDestroy.mockResolvedValue({ result: 'ok' });

    const { deleteImage } = await import('../cloudinary');
    await deleteImage('https://res.cloudinary.com/demo/image/upload/v123/rentalpro/properties/abc123.jpg');

    expect(mockDestroy).toHaveBeenCalledWith('v123/rentalpro/properties/abc123');
  });

  it('does nothing for invalid URL', async () => {
    const { deleteImage } = await import('../cloudinary');
    await deleteImage('not-a-valid-url');

    expect(mockDestroy).not.toHaveBeenCalled();
  });
});
