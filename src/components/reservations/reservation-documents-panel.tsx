"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileUp,
  UploadCloud,
  FileText,
  FileImage,
  MoreHorizontal,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ReservationDocument = {
  id: string;
  category: "CONTRATO" | "ANEXO" | "INVENTARIO" | "OTRO";
  documentType: "PDF" | "JPG" | "PNG" | "WEBP";
  fileName: string;
  fileSize: number;
};

const MAX_DOCUMENTS = 10;

const categoryLabels: Record<ReservationDocument["category"], string> = {
  CONTRATO: "Contrato",
  ANEXO: "Anexo",
  INVENTARIO: "Inventario",
  OTRO: "Otro",
};

// Subtle category tone: differentiate by label, not by color (per DESIGN.md)
const categoryBadgeVariant: Record<
  ReservationDocument["category"],
  "default" | "secondary" | "outline"
> = {
  CONTRATO: "default",
  ANEXO: "outline",
  INVENTARIO: "outline",
  OTRO: "secondary",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentIcon({ type }: { type: ReservationDocument["documentType"] }) {
  if (type === "PDF") return <FileText className="size-4" aria-hidden="true" />;
  return <FileImage className="size-4" aria-hidden="true" />;
}

export function ReservationDocumentsPanel({ reservationId }: { reservationId: string }) {
  const [documents, setDocuments] = useState<ReservationDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState<ReservationDocument["category"]>("CONTRATO");
  const [file, setFile] = useState<File | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reservation-documents?reservationId=${reservationId}`);
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDocuments(result.documents || []);
    } catch {
      toast.error("Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("reservationId", reservationId);
      formData.append("category", category);
      formData.append("file", file);

      const res = await fetch("/api/reservation-documents", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Documento subido");
      setDialogOpen(false);
      setFile(null);
      setCategory("CONTRATO");
      await loadDocuments();
    } catch {
      toast.error("Error al subir documento");
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (id: string) => {
    const res = await fetch(`/api/reservation-documents/${id}`);
    const result = await res.json();
    if (result.error || !result.url) {
      toast.error(result.error || "No se pudo abrir documento");
      return;
    }
    window.open(result.url, "_blank");
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/reservation-documents/${id}`, { method: "DELETE" });
    const result = await res.json();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Documento eliminado");
    await loadDocuments();
  };

  const atLimit = documents.length >= MAX_DOCUMENTS;
  const remaining = MAX_DOCUMENTS - documents.length;

  return (
    <div className="rounded-lg ring-1 ring-border bg-card overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">Documentos</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5 tabular-nums">
            {documents.length} de {MAX_DOCUMENTS}
          </p>
        </div>
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs shrink-0"
          onClick={() => setDialogOpen(true)}
          disabled={atLimit}
          title={atLimit ? `Límite de ${MAX_DOCUMENTS} documentos alcanzado` : undefined}
        >
          <FileUp className="size-3.5 mr-1.5" />
          Subir
        </Button>
      </div>

      {/* ─── Body ─── */}
      <div className="divide-y divide-border">
        {loading && (
          <p className="text-xs text-muted-foreground p-4 text-center">Cargando…</p>
        )}

        {!loading && documents.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 py-6 px-4 text-center">
            <UploadCloud className="size-5 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-xs font-medium text-muted-foreground">Sin documentos aún</p>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Contratos, anexos o inventarios<br />
              se guardan aquí.
            </p>
          </div>
        )}

        {!loading &&
          documents.map((doc) => (
            <div key={doc.id} className="flex items-start gap-2.5 p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground mt-0.5">
                <DocumentIcon type={doc.documentType} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-medium text-foreground truncate"
                  title={doc.fileName}
                >
                  {doc.fileName}
                </p>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1">
                  <Badge variant={categoryBadgeVariant[doc.category]} className="text-[10px]">
                    {categoryLabels[doc.category]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {doc.documentType} · {formatFileSize(doc.fileSize)}
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground mt-0.5"
                      aria-label={`Más acciones para ${doc.fileName}`}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => handleOpen(doc.id)}>
                    <ExternalLink className="mr-2 size-4" />
                    Ver documento
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

        {/* Capacity hint when near limit */}
        {!loading && documents.length > 0 && remaining <= 3 && (
          <p
            className={cn(
              "text-[10px] font-medium uppercase tracking-wider text-center px-4 py-2",
              remaining === 0
                ? "text-warning"
                : "text-muted-foreground",
            )}
          >
            {remaining === 0
              ? `Límite de ${MAX_DOCUMENTS} alcanzado`
              : `${remaining} ${remaining === 1 ? "espacio restante" : "espacios restantes"}`}
          </p>
        )}
      </div>

      {/* ─── Upload dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-sm gap-0 p-0 overflow-hidden">
          <DialogHeader className="border-b border-border px-5 py-4 flex-row items-center justify-between gap-2 space-y-0">
            <DialogTitle>Subir documento</DialogTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDialogOpen(false)}
              aria-label="Cerrar"
              className="text-muted-foreground hover:text-foreground -mr-2"
            >
              ✕
            </Button>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label
                htmlFor="doc-category"
                className="text-sm font-medium text-foreground"
              >
                Tipo de documento
              </label>
              <Select
                value={category}
                onValueChange={(v) =>
                  setCategory(v as ReservationDocument["category"])
                }
              >
                <SelectTrigger id="doc-category" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTRATO">Contrato</SelectItem>
                  <SelectItem value="ANEXO">Anexo</SelectItem>
                  <SelectItem value="INVENTARIO">Inventario</SelectItem>
                  <SelectItem value="OTRO">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Archivo</label>
              <FileInput onFileSelect={setFile} selectedFile={file} />
            </div>
          </div>
          <div className="flex gap-2 justify-end border-t border-border px-5 py-3 bg-muted/30">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? "Subiendo…" : "Subir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileInput({
  onFileSelect,
  selectedFile,
}: {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onFileSelect(file);
  };

  const handleRemove = () => {
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (selectedFile) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
            <FileText className="size-3.5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs shrink-0"
          onClick={handleRemove}
        >
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 p-5 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus:outline-none"
    >
      <UploadCloud className="size-7 text-muted-foreground/60 mb-1.5" aria-hidden="true" />
      <p className="text-xs font-medium text-foreground">Seleccionar archivo</p>
      <p className="text-[11px] text-muted-foreground/70 mt-1">
        PDF, JPG, PNG, WebP — máx 10 MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
        aria-label="Subir archivo"
      />
    </button>
  );
}