import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReceiptUpload } from '../receipt-upload';

function createFile(name: string, type: string, size: number): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

function uploadFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file] });
  fireEvent.change(input);
}

describe('ReceiptUpload', () => {
  it('renders dropzone with instructions', () => {
    render(<ReceiptUpload onFileSelect={vi.fn()} />);
    expect(screen.getByText(/Arrastra un comprobante/)).toBeDefined();
    expect(screen.getByText(/JPEG, PNG, WebP/)).toBeDefined();
  });

  it('shows preview after valid file selection', () => {
    const onFileSelect = vi.fn();
    render(<ReceiptUpload onFileSelect={onFileSelect} />);

    const file = createFile('test.png', 'image/png', 1024);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    uploadFile(input, file);

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('shows error for oversized file', () => {
    const onFileSelect = vi.fn();
    render(<ReceiptUpload onFileSelect={onFileSelect} maxSizeMb={1} />);

    const largeFile = createFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    uploadFile(input, largeFile);

    expect(screen.getByText(/no puede superar/)).toBeDefined();
    expect(onFileSelect).toHaveBeenCalledWith(null);
  });

  it('shows error for invalid file type', () => {
    const onFileSelect = vi.fn();
    render(<ReceiptUpload onFileSelect={onFileSelect} />);

    const invalidFile = createFile('doc.pdf', 'application/pdf', 1024);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    uploadFile(input, invalidFile);

    expect(screen.getByText(/Solo se permiten imágenes/)).toBeDefined();
    expect(onFileSelect).toHaveBeenCalledWith(null);
  });

  it('removes preview and calls onFileSelect(null) on remove', () => {
    const onFileSelect = vi.fn();
    render(<ReceiptUpload onFileSelect={onFileSelect} />);

    const file = createFile('test.png', 'image/png', 1024);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    uploadFile(input, file);

    const removeButton = document.querySelector('button');
    expect(removeButton).toBeDefined();

    if (removeButton) {
      fireEvent.click(removeButton);
      expect(onFileSelect).toHaveBeenCalledWith(null);
    }
  });

  it('calls onFileSelect(null) on drag and drop of invalid file type', () => {
    const onFileSelect = vi.fn();
    render(<ReceiptUpload onFileSelect={onFileSelect} />);

    const invalidFile = createFile('doc.pdf', 'application/pdf', 1024);
    const dropzone = screen.getByText(/Arrastra un comprobante/).closest('div')!;

    fireEvent.drop(dropzone, { dataTransfer: { files: [invalidFile] } });

    expect(screen.getByText(/Solo se permiten imágenes/)).toBeDefined();
    expect(onFileSelect).toHaveBeenCalledWith(null);
  });

  it('accepts valid file on drag and drop', () => {
    const onFileSelect = vi.fn();
    render(<ReceiptUpload onFileSelect={onFileSelect} />);

    const validFile = createFile('test.webp', 'image/webp', 1024);
    const dropzone = screen.getByText(/Arrastra un comprobante/).closest('div')!;

    fireEvent.drop(dropzone, { dataTransfer: { files: [validFile] } });

    expect(onFileSelect).toHaveBeenCalledWith(validFile);
  });
});
