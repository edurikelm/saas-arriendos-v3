"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteUser } from "@/lib/actions/super-admin";

/**
 * Eliminar un owner desde su detalle. La regla de qué se puede borrar vive en
 * `deleteUser`; acá solo se anticipa el bloqueo por suscripción para no ofrecer
 * un diálogo que va a terminar en error.
 */
export function AdminDeleteOwnerButton({
  ownerId,
  email,
  hasSubscriptionHistory,
}: {
  ownerId: string;
  email: string;
  hasSubscriptionHistory: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (hasSubscriptionHistory) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled
          aria-describedby="delete-owner-blocked"
        >
          <Trash2 className="size-4 mr-2" />
          Eliminar propietario
        </Button>
        <p id="delete-owner-blocked" className="text-xs text-muted-foreground">
          No se puede eliminar: tuvo una suscripción PRO y ese es el registro de cobro. Para
          darlo de baja, usa «Cancelar cuenta».
        </p>
      </div>
    );
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setConfirmEmail("");
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteUser(ownerId, confirmEmail.trim());
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Propietario eliminado");
      router.push("/admin/users");
    } catch {
      toast.error("No se pudo eliminar el propietario");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4 mr-2" />
        Eliminar propietario
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="¿Eliminar propietario?"
        description="Se borran su cuenta, propiedades, reservas, pagos, clientes, calendarios externos, documentos, notificaciones, tickets de soporte y notas internas. No se puede deshacer."
        confirmLabel={deleting ? "Eliminando..." : "Eliminar"}
        confirmDisabled={deleting || confirmEmail.trim() !== email}
        onConfirm={handleDelete}
      >
        <div className="space-y-2">
          {/* `block`: la base de Label es flex con gap, y un email como hijo aparte queda con espacios dobles. */}
          <Label htmlFor="confirm-owner-email" className="block leading-snug break-words">
            Para confirmar, escribe {email}
          </Label>
          <Input
            id="confirm-owner-email"
            type="email"
            autoComplete="off"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
