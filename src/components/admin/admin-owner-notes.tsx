"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Plus, Loader2, StickyNote } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

interface Note {
  id: string;
  adminId: string;
  ownerId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  admin: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface AdminOwnerNotesProps {
  ownerId: string;
}

export function AdminOwnerNotes({ ownerId }: AdminOwnerNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/notes?ownerId=${ownerId}`);
      if (!res.ok) {
        toast.error("Error al cargar notas");
        return;
      }
      const data = await res.json();
      setNotes(data);
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    fetchNotes();
  }, [fetchNotes]);

  const handleCreateNote = async () => {
    if (!newNoteContent.trim()) {
      toast.error("La nota no puede estar vacía");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId, content: newNoteContent }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Error al crear nota");
        return;
      }

      const createdNote = await res.json();
      setNotes([createdNote, ...notes]);
      setNewNoteContent("");
      toast.success("Nota creada correctamente");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!deleteNoteId) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/notes?noteId=${deleteNoteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Error al eliminar nota");
        return;
      }

      setNotes(notes.filter((n) => n.id !== deleteNoteId));
      toast.success("Nota eliminada correctamente");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeleting(false);
      setDeleteNoteId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notas internas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notas internas
          </CardTitle>
          <CardDescription>
            Solo visibles para admins. {notes.length} nota{notes.length !== 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Agregar una nota interna..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleCreateNote}
              disabled={creating || !newNoteContent.trim()}
              size="sm"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar nota
                </>
              )}
            </Button>
          </div>

          {notes.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No hay notas internas. Agrega la primera.
            </p>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-4 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {getInitials(note.admin.name, note.admin.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {note.admin.name || note.admin.email}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteNoteId(note.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteNoteId}
        onOpenChange={() => setDeleteNoteId(null)}
        title="Eliminar nota"
        description="¿Estás seguro de que quieres eliminar esta nota? Esta acción no se puede deshacer."
        onConfirm={handleDeleteNote}
        confirmLabel={deleting ? "Eliminando..." : "Eliminar"}
      />
    </>
  );
}