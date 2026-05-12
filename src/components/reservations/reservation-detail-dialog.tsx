"use client";

import { useState } from "react";
import {
  Calendar,
  User,
  CreditCard,
  CheckCircle2,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
  FileText,
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

interface Payment {
  id: string;
  amount: string;
  status: string;
  method: string;
  initPoint?: string | null;
  expiresAt?: string | null;
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
  onAddPayment?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onRefresh?: (reservationId: string) => void;
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

function PaymentItem({
  payment,
  onCopyLink,
  onRegenerateLink,
  onConfirmPayment,
  onDeletePayment,
}: {
  payment: Payment;
  onCopyLink?: () => void;
  onRegenerateLink?: () => void;
  onConfirmPayment?: () => void;
  onDeletePayment?: () => void;
}) {
  const isExpired =
    payment.expiresAt &&
    new Date(payment.expiresAt) < new Date() &&
    payment.status === "PENDING";

  return (
    <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center",
            payment.status === "COMPLETED"
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-orange-100 dark:bg-orange-900/30"
          )}
        >
          {payment.status === "COMPLETED" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <CreditCard className="h-4 w-4 text-orange-600" />
          )}
        </div>
        <div>
          <p className="font-medium text-sm">{paymentMethodLabels[payment.method]}</p>
          <p className={cn("text-xs", payment.status === "COMPLETED" ? "text-green-600" : "text-orange-600")}>
            {payment.status === "COMPLETED" ? "Pagado" : isExpired ? "Expirado" : "Pendiente"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm">{formatPrice(payment.amount)}</p>
        {payment.method === "MERCADO_PAGO" &&
          payment.initPoint &&
          payment.status === "PENDING" &&
          !isExpired &&
          onCopyLink && (
            <Button size="icon-xs" variant="ghost" className="h-7 w-7" onClick={onCopyLink}>
              <Copy className="h-3 w-3" />
            </Button>
          )}
        {payment.method === "MERCADO_PAGO" &&
          isExpired &&
          payment.status === "PENDING" &&
          onRegenerateLink && (
            <Button size="icon-xs" variant="ghost" className="h-7 w-7 text-blue-600" onClick={onRegenerateLink}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        {payment.method !== "MERCADO_PAGO" &&
          payment.status === "PENDING" &&
          onConfirmPayment && (
            <Button size="sm" variant="ghost" className="text-green-600 h-7 px-2" onClick={onConfirmPayment}>
              Confirmar
            </Button>
          )}
        {onDeletePayment && (
          <Button size="icon-xs" variant="ghost" className="h-7 w-7 text-red-600" onClick={onDeletePayment}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function PaymentForm({
  totalPrice,
  payments,
  onSubmit,
  onCancel,
  onGenerateLink,
  isGeneratingLink,
}: {
  totalPrice: string;
  payments: Payment[];
  onSubmit?: (data: { amount: number; method: "MERCADO_PAGO" | "CASH" | "TRANSFER"; status: "COMPLETED" | "PENDING" }) => void;
  onCancel?: () => void;
  onGenerateLink?: (amount: number) => Promise<void>;
  isGeneratingLink?: boolean;
}) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"MERCADO_PAGO" | "CASH" | "TRANSFER">("CASH");
  const [paymentStatus, setPaymentStatus] = useState<"COMPLETED" | "PENDING">("COMPLETED");

  const completedAmount = payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const maxAmount = Number(totalPrice) - completedAmount;

  return (
    <div className="p-4 rounded-md bg-muted/50 border border-border space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Nuevo Pago</p>
        <span className="text-xs text-muted-foreground">Max: {formatPrice(maxAmount)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Monto</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              max={maxAmount}
              min="0"
              step="100"
              className="h-8 flex-1"
              placeholder="$0"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              onClick={() => setPaymentAmount(maxAmount.toString())}
            >
              Max
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Método</Label>
          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Efectivo</SelectItem>
              <SelectItem value="TRANSFER">Transferencia</SelectItem>
              <SelectItem value="MERCADO_PAGO">Mercado Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {paymentMethod === "MERCADO_PAGO" && (
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onGenerateLink?.(Number(paymentAmount))}
            disabled={!paymentAmount || Number(paymentAmount) <= 0 || isGeneratingLink}
            className="w-full h-8"
          >
            {isGeneratingLink ? (
              <>
                <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin mr-2" />
                Generando...
              </>
            ) : (
              <>
                <CreditCard className="h-3 w-3 mr-2" />
                Generar Link de Pago
              </>
            )}
          </Button>
        </div>
      )}

      {paymentMethod !== "MERCADO_PAGO" && (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={paymentStatus === "COMPLETED"} onChange={() => setPaymentStatus("COMPLETED")} />
            Completado
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={paymentStatus === "PENDING"} onChange={() => setPaymentStatus("PENDING")} />
            Pendiente
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onSubmit?.({ amount: Number(paymentAmount), method: paymentMethod, status: paymentStatus })}
          disabled={
            !paymentAmount ||
            Number(paymentAmount) <= 0 ||
            (paymentMethod === "MERCADO_PAGO" && !isGeneratingLink && !paymentAmount)
          }
          className="h-8"
        >
          Registrar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-8">
          Cancelar
        </Button>
      </div>
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
  onAddPayment,
  onEdit,
  onCancel,
  onRefresh,
}: ReservationDetailProps) {
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const nights = getNights(reservation.startDate, reservation.endDate);
  const paidAmount = reservation.payments.filter((p) => p.status === "COMPLETED").reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Number(reservation.totalPrice) - paidAmount;
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

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
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pago confirmado");
      onRefresh?.(reservation.id);
      onConfirmPayment?.(paymentId);
    } catch {
      toast.error("Error al confirmar pago");
    }
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

  const handleAddPayment = async (data: { amount: number; method: "MERCADO_PAGO" | "CASH" | "TRANSFER"; status: "COMPLETED" | "PENDING" }) => {
    if (data.method === "MERCADO_PAGO") {
      toast.error("Primero genera el link de pago");
      return;
    }
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: reservation.id,
          amount: data.amount,
          method: data.method,
          status: data.status,
        }),
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pago registrado");
      setShowPaymentForm(false);
      onRefresh?.(reservation.id);
      onAddPayment?.();
    } catch {
      toast.error("Error al registrar pago");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
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
              {reservation.billingType === "DAILY" ? "Tarifa" : "Tarifa mensual"}
            </p>
            <p className="text-xl font-bold text-primary">{formatPrice(reservation.totalPrice)}</p>
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

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Pagos ({reservation.payments.length})</p>
            {reservation.status !== "CANCELLED" && (
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowPaymentForm(!showPaymentForm)}>
                <Plus className="h-3 w-3 mr-1" />
                {showPaymentForm ? "Cancelar" : "Agregar"}
              </Button>
            )}
          </div>

          {showPaymentForm && (
            <div className="mb-3">
              <PaymentForm
                totalPrice={reservation.totalPrice}
                payments={reservation.payments}
                onCancel={() => setShowPaymentForm(false)}
                onSubmit={handleAddPayment}
                onGenerateLink={handleGenerateLink}
                isGeneratingLink={isGeneratingLink}
              />
            </div>
          )}

          <div className="space-y-2">
            {reservation.payments.map((payment) => (
              <PaymentItem
                key={payment.id}
                payment={payment}
                onCopyLink={() => payment.initPoint && handleCopyLink(payment.initPoint)}
                onRegenerateLink={() => handleRegenerateLink(payment.id)}
                onConfirmPayment={() => handleConfirmPayment(payment.id)}
                onDeletePayment={() => handleDeletePayment(payment.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-border mt-6">
          <Button variant="outline" size="sm" className="flex-1 h-8" onClick={onEdit}>Editar Reserva</Button>
          {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
            <Button variant="destructive" size="sm" className="h-8" onClick={onCancel}>Cancelar</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}