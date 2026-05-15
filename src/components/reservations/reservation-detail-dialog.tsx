"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  User,
  CreditCard,
  Check,
  RefreshCw,
  FileText,
  ExternalLink,
  Copy,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { confirmPayment, revertPayment, generatePaymentLink, markPaymentAsPaid } from "@/lib/actions/payments";
import { CheckCircle, Search } from "lucide-react";
import { AddPaymentDialog } from "./add-payment-dialog";

interface Payment {
  id: string;
  installmentIndex?: number;
  amount: string;
  dueDate?: string | null;
  status: string;
  method: string;
  initPoint?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  deletedAt?: string | null;
}

interface Property {
  id: string;
  name: string;
  color?: string;
  unitsAvailable?: number;
  dailyPrice?: string;
  monthlyPrice?: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface ReservationDetailProps {
  reservation: {
    id: string;
    propertyId: string;
    clientId: string;
    startDate: string;
    endDate: string;
    billingType: string;
    unitsBooked: number;
    totalPrice: string;
    status: string;
    bookingAirbnb: boolean;
    notes: string | null;
    property: Property;
    client: Client;
    payments: Payment[];
  };
  open: boolean;
  onClose: () => void;
  onCopyLink?: (initPoint: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onConfirmPayment?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onRefresh?: (reservationId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onAddPayment?: () => void;
  onCheckPaymentStatus?: (paymentId: string) => void;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  CONFIRMED: { label: "Confirmada", variant: "default" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  COMPLETED: { label: "Completada", variant: "outline" },
};

const paymentStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  COMPLETED: { label: "Pagado", variant: "outline" },
  FAILED: { label: "Fallido", variant: "destructive" },
};

const paymentMethodLabels: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDueDate(dateString: string): string {
  return format(new Date(dateString), "d MMM yyyy", { locale: es } as any);
}

function formatAmount(amount: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("CLP", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

function getNights(startDate: string, endDate: string): number {
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function getMonths(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return months >= 1 ? months : 1;
}

function PaymentsTable({
  payments,
  onGenerateLink,
  onMarkPaid,
  showInstallmentColumns,
}: {
  payments: Payment[];
  onGenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  showInstallmentColumns: boolean;
}) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            {showInstallmentColumns && (
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Cuota</th>
            )}
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Monto</th>
            {showInstallmentColumns && (
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Vencimiento</th>
            )}
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Fecha Pago</th>
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Medio</th>
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Estado</th>
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {[...payments].sort((a, b) => (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0)).map((payment) => {
            const statusCfg = paymentStatusConfig[payment.status] || paymentStatusConfig.PENDING;
            return (
              <tr key={payment.id} className="border-t border-border">
                {showInstallmentColumns && (
                  <td className="px-2 py-2 font-medium">
                    {payment.installmentIndex ?? "—"}
                  </td>
                )}
                <td className="px-2 py-2">{formatAmount(payment.amount)}</td>
                {showInstallmentColumns && (
                  <td className="px-2 py-2">
                    {payment.dueDate ? formatDueDate(payment.dueDate) : "—"}
                  </td>
                )}
                <td className="px-2 py-2 text-muted-foreground text-xs">
                  {payment.paidAt ? formatDate(payment.paidAt) : "—"}
                </td>
                <td className="px-2 py-2">
                  {payment.method === "MERCADO_PAGO" ? "Mercado Pago" : payment.method === "CASH" ? "Efectivo" : payment.method === "TRANSFER" ? "Transferencia" : "—"}
                </td>
                <td className="px-2 py-2">
                  <Badge variant={statusCfg.variant} className="text-xs">{statusCfg.label}</Badge>
                </td>
                <td className="px-2 py-2">
                  {payment.status === "PENDING" && (
                    <div className="flex gap-1">
                      {payment.method === "MERCADO_PAGO" && !payment.initPoint && onGenerateLink && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => onGenerateLink(payment.id)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Generar Link
                        </Button>
                      )}
                      {payment.method === "MERCADO_PAGO" && payment.initPoint && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(payment.initPoint!);
                              toast.success("Link copiado al portapapeles");
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copiar Link
                          </Button>
                        </>
                      )}
                      {onMarkPaid && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => onMarkPaid(payment.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Marcar Pagado
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}



export function ReservationDetailDialog({
  reservation,
  open,
  onClose,
  onCopyLink,
  onRegenerateLink,
  onConfirmPayment,
  onDeletePayment,
  onEdit,
  onCancel,
  onRefresh,
  onAddPayment,
}: ReservationDetailProps) {
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const nights = getNights(reservation.startDate, reservation.endDate);
  const paidAmount = reservation.payments.filter((p) => p.status === "COMPLETED").reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Number(reservation.totalPrice) - paidAmount;

  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [markPaidPaymentId, setMarkPaidPaymentId] = useState<string | null>(null);
  const [markPaidDate, setMarkPaidDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [markPaidMethod, setMarkPaidMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [isCheckingAllPayments, setIsCheckingAllPayments] = useState(false);

  const handleCopyLink = (initPoint: string) => {
    navigator.clipboard.writeText(initPoint);
    toast.success("Link copiado al portapapeles");
    onCopyLink?.(initPoint);
  };

  const handleRegenerateLink = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Link regenerado");
      onRefresh?.(reservation.id);
      onRegenerateLink?.(paymentId);
    } catch {
      toast.error("Error al regenerar link");
    }
  };

  const handleConfirmPayment = async (paymentId: string) => {
    const result = await confirmPayment(paymentId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Pago confirmado");
    onRefresh?.(reservation.id);
    onConfirmPayment?.(paymentId);
  };

  const handleRevertPayment = async (paymentId: string) => {
    const result = await revertPayment(paymentId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Pago revertido a pendiente");
    onRefresh?.(reservation.id);
  };

  const handleMarkPaidClick = (paymentId: string) => {
    setMarkPaidPaymentId(paymentId);
    setMarkPaidDate(format(new Date(), "yyyy-MM-dd"));
    setMarkPaidMethod("CASH");
    setShowMarkPaidModal(true);
  };

  const handleConfirmMarkPaid = async () => {
    if (!markPaidPaymentId) return;
    const result = await markPaymentAsPaid(markPaidPaymentId, new Date(markPaidDate), markPaidMethod);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Pago marcado como pagado");
    setShowMarkPaidModal(false);
    setMarkPaidPaymentId(null);
    onRefresh?.(reservation.id);
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!confirm("¿Eliminar este pago?")) return;
    toast.success("Pago eliminado", {
      action: {
        label: "Deshacer",
        onClick: async () => {
          try {
            const res = await fetch(`/api/payments/${paymentId}`, {
              method: "PUT",
            });
            if (res.ok) {
              toast.success("Pago restaurado");
onRefresh?.(reservation.id);
            }
          } catch {
            toast.error("Error al restaurar pago");
          }
        },
      },
      duration: 5000,
    });
    fetch(`/api/payments/${paymentId}`, { method: "DELETE" }).then((res) => {
      if (res.ok) {
onRefresh?.(reservation.id);
        onDeletePayment?.(paymentId);
      }
    });
  };

  const handleRefreshPayments = async () => {
    setIsCheckingAllPayments(true);
    try {
      const res = await fetch(`/api/payments/reservation/${reservation.id}/refresh`);
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onRefresh?.(reservation.id);
    } catch {
      toast.error("Error al refrescar pagos");
    } finally {
      setIsCheckingAllPayments(false);
    }
  };

  const handleGenerateLink = async (amount: number) => {
    if (amount <= 0) return;
    setIsGeneratingLink(true);
    try {
      const res = await fetch("/api/payments/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: reservation.id,
          amount,
        }),
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Link generado - Copia el link desde el listado de pagos");
      onRefresh?.(reservation.id);
    } catch {
      toast.error("Error al generar link");
    } finally {
      setIsGeneratingLink(false);
    }
  };



  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-auto overflow-x-auto">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: reservation.property.color || "#3B82F6" }}
            >
              {reservation.property.name[0]}
            </div>
            <div>
              <DialogTitle className="text-base">{reservation.property.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">#{reservation.id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reservation.bookingAirbnb && <Badge variant="outline" className="h-5 text-xs">Airbnb</Badge>}
            <Badge variant={status.variant} className="h-5 text-xs">{status.label}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-3 rounded-md bg-muted/30 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              Período
            </div>
            <p className="font-medium text-sm">{formatDate(reservation.startDate)}</p>
            <p className="text-xs text-muted-foreground">hasta</p>
            <p className="font-medium text-sm">{formatDate(reservation.endDate)}</p>
            <p className="text-xs text-muted-foreground mt-1">{reservation.billingType === "MONTHLY" ? `${getMonths(reservation.startDate, reservation.endDate)} meses` : `${nights} noches`}</p>
          </div>

          <div className="p-3 rounded-md bg-muted/30 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <User className="h-3 w-3" />
              Huésped
            </div>
            <p className="font-medium text-sm">{reservation.client.name}</p>
            <p className="text-xs text-muted-foreground truncate">{reservation.client.email}</p>
            {reservation.client.phone && <p className="text-xs text-muted-foreground">{reservation.client.phone}</p>}
          </div>

          <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">
              {reservation.billingType === "DAILY" ? "Tarifa" : "Total arriendo"}
            </p>
            <p className="text-xl font-bold text-primary">{formatPrice(reservation.totalPrice)}</p>
            {reservation.billingType === "MONTHLY" && reservation.property.monthlyPrice && (
              <p className="text-xs text-muted-foreground mt-1">
                ({formatPrice(reservation.property.monthlyPrice)}/mes × {getMonths(reservation.startDate, reservation.endDate)} meses)
              </p>
            )}
            {reservation.billingType === "DAILY" && reservation.property.dailyPrice && (
              <p className="text-xs text-muted-foreground mt-1">
                ({formatPrice(reservation.property.dailyPrice)}/noche × {nights} noches)
              </p>
            )}
            {pendingAmount > 0 && <p className="text-xs text-orange-600 mt-1">{formatPrice(pendingAmount)} pend.</p>}
          </div>
        </div>

        {reservation.notes && (
          <div className="p-3 rounded-md bg-muted/30 border border-border mb-6">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Notas</p>
            </div>
            <p className="text-sm">{reservation.notes}</p>
          </div>
        )}

        {(reservation.billingType === "MONTHLY" ||
          (reservation.payments && reservation.payments.length > 0)) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">
                {reservation.billingType === "MONTHLY" ? "Cuotas de arriendo" : "Pagos"}
              </p>
              {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
                <div className="flex gap-2">
                  {reservation.payments && reservation.payments.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleRefreshPayments}
                      disabled={isCheckingAllPayments}
                    >
                      <RefreshCw className={cn("h-3 w-3 mr-1", isCheckingAllPayments && "animate-spin")} />
                      {isCheckingAllPayments ? "Verificando..." : "Verificar"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setShowAddPaymentDialog(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar Pago
                  </Button>
                </div>
              )}
            </div>
            <PaymentsTable
              payments={reservation.payments}
              onGenerateLink={handleRegenerateLink}
              onMarkPaid={handleMarkPaidClick}
              showInstallmentColumns={reservation.billingType === "MONTHLY"}
            />
          </div>
        )}

        {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && reservation.payments?.length === 0 && (
          <div className="mb-6">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8"
              onClick={() => setShowAddPaymentDialog(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar Pago
            </Button>
          </div>
        )}



        <div className="flex gap-2 pt-4 border-t border-border mt-6">
          <Button variant="outline" size="sm" className="flex-1 h-8" onClick={onEdit}>Editar Reserva</Button>
          {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
            <Button variant="destructive" size="sm" className="h-8" onClick={onCancel}>Cancelar</Button>
          )}
        </div>

        <Dialog open={showMarkPaidModal} onOpenChange={setShowMarkPaidModal}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Marcar Pago como Pagado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs">Fecha de Pago</Label>
                <Input
                  type="date"
                  value={markPaidDate}
                  onChange={(e) => setMarkPaidDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Método de Pago</Label>
                <Select value={markPaidMethod} onValueChange={(v) => setMarkPaidMethod(v as typeof markPaidMethod)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Efectivo</SelectItem>
                    <SelectItem value="TRANSFER">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowMarkPaidModal(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleConfirmMarkPaid}>Confirmar</Button>
            </div>
          </DialogContent>
        </Dialog>

        <AddPaymentDialog
          reservationId={reservation.id}
          totalPrice={reservation.totalPrice}
          paidAmount={paidAmount}
          open={showAddPaymentDialog}
          onOpenChange={setShowAddPaymentDialog}
          onSuccess={() => onRefresh?.(reservation.id)}
        />
      </DialogContent>
    </Dialog>
  );
}