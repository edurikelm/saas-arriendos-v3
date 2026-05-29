"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUp, UploadCloud } from "lucide-react";

type ReservationDocument = {
  id: string;
  category: "CONTRATO" | "ANEXO" | "INVENTARIO" | "OTRO";
  documentType: "PDF" | "JPG" | "PNG" | "WEBP";
  fileName: string;
  fileSize: number;
};

const categoryLabels: Record<ReservationDocument["category"], string> = {
  CONTRATO: "Contrato",
  ANEXO: "Anexo",
  INVENTARIO: "Inventario",
  OTRO: "Otro",
};

export function ReservationDocumentsPanel({ reservationId }: { reservationId: string }) {
  const [documents, setDocuments] = useState<ReservationDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState<ReservationDocument["category"]>("CONTRATO");
  const [file, setFile] = useState<File | null>(null);

  const loadDocuments = async () => {
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
  };

  useEffect(() => {
    loadDocuments();
  }, [reservationId]);

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

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Documentos de reserva mensual</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{documents.length}/10</p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDialogOpen(true)}>
            <FileUp className="h-3 w-3 mr-1" />
            Subir documento
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border divide-y">
        {loading && <p className="text-xs text-muted-foreground p-3">Cargando...</p>}
        {!loading && documents.length === 0 && (
          <p className="text-xs text-muted-foreground p-3">Sin documentos aún.</p>
        )}
        {!loading && documents.map((doc) => (
          <div key={doc.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{doc.fileName}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{categoryLabels[doc.category]}</Badge>
                <span className="text-[11px] text-muted-foreground">{doc.documentType}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7" onClick={() => handleOpen(doc.id)}>Ver/Descargar</Button>
              <Button size="sm" variant="destructive" className="h-7" onClick={() => handleDelete(doc.id)}>Eliminar</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>Subir Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tipo de documento</p>
              <Select value={category} onValueChange={(v) => setCategory(v as ReservationDocument["category"])}>
                <SelectTrigger className="h-9">
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
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Archivo</p>
              <FileInput onFileSelect={setFile} selectedFile={file} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setDialogOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? "Subiendo..." : "Subir"}
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
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{selectedFile.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleRemove}>
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 p-4 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/20"
    >
      <UploadCloud className="h-6 w-6 text-muted-foreground mb-1" />
      <p className="text-xs text-muted-foreground">Haz clic para seleccionar un archivo</p>
      <p className="text-[11px] text-muted-foreground/60 mt-1">PDF, JPG, PNG, WebP — máx 10 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
