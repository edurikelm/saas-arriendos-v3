"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
      setFile(null);
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
        <p className="text-xs text-muted-foreground">{documents.length}/10</p>
      </div>

      <div className="rounded-md border border-border p-3 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as ReservationDocument["category"])}>
            <SelectTrigger className="w-full sm:w-[180px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CONTRATO">Contrato</SelectItem>
              <SelectItem value="ANEXO">Anexo</SelectItem>
              <SelectItem value="INVENTARIO">Inventario</SelectItem>
              <SelectItem value="OTRO">Otro</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs w-full"
          />
          <Button size="sm" className="h-8" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Subiendo..." : "Subir"}
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
    </div>
  );
}
