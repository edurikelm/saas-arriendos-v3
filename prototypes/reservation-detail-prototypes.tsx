"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  User,
  Home,
  CreditCard,
  CheckCircle2,
  XCircle,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Mail,
  Phone,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

interface Payment {
  id: string;
  amount: string;
  status: string;
  method: string;
  initPoint?: string | null;
  expiresAt?: string | null;
}

interface Property {
  id: string;
  name: string;
  color?: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface Reservation {
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

const mockReservation: Reservation = {
  id: "1",
  propertyId: "1",
  clientId: "1",
  startDate: "2026-05-15",
  endDate: "2026-05-20",
  billingType: "DAILY",
  unitsBooked: 1,
  totalPrice: "425000",
  status: "CONFIRMED",
  bookingAirbnb: true,
  notes: "Cliente prefiere silencio. Necesita sofá cama extra.",
  property: { id: "1", name: "Casa del Lago", color: "#3B82F6" },
  client: {
    id: "1",
    name: "María García",
    email: "maria.garcia@gmail.com",
    phone: "+56 9 1234 5678",
  },
  payments: [
    {
      id: "p1",
      amount: "200000",
      status: "COMPLETED",
      method: "MERCADO_PAGO",
    },
    {
      id: "p2",
      amount: "225000",
      status: "PENDING",
      method: "TRANSFER",
      expiresAt: "2026-05-10T23:59:59Z",
    },
  ],
};

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
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center",
            payment.status === "COMPLETED"
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-orange-100 dark:bg-orange-900/30"
          )}
        >
          {payment.status === "COMPLETED" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <Clock className="h-4 w-4 text-orange-600" />
          )}
        </div>
        <div>
          <p className="font-medium text-sm">{paymentMethodLabels[payment.method]}</p>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs",
                payment.status === "COMPLETED" ? "text-green-600" : "text-orange-600"
              )}
            >
              {payment.status === "COMPLETED"
                ? "Pagado"
                : isExpired
                ? "Expirado"
                : "Pendiente"}
            </span>
            {isExpired && (
              <Badge variant="destructive" className="text-xs h-5">
                Expirado
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-bold text-sm">{formatPrice(payment.amount)}</p>
        {payment.method === "MERCADO_PAGO" &&
          payment.initPoint &&
          payment.status === "PENDING" &&
          !isExpired &&
          onCopyLink && (
            <Button
              size="icon-xs"
              variant="ghost"
              className="h-7 w-7"
              onClick={onCopyLink}
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}
        {payment.method === "MERCADO_PAGO" &&
          isExpired &&
          payment.status === "PENDING" &&
          onRegenerateLink && (
            <Button
              size="icon-xs"
              variant="ghost"
              className="h-7 w-7 text-blue-600"
              onClick={onRegenerateLink}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        {payment.method !== "MERCADO_PAGO" &&
          payment.status === "PENDING" &&
          onConfirmPayment && (
            <Button
              size="sm"
              variant="ghost"
              className="text-green-600 h-7 px-2"
              onClick={onConfirmPayment}
            >
              Confirmar
            </Button>
          )}
        {onDeletePayment && (
          <Button
            size="icon-xs"
            variant="ghost"
            className="h-7 w-7 text-red-600"
            onClick={onDeletePayment}
          >
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
}: {
  totalPrice: string;
  payments: Payment[];
  onSubmit?: (data: {
    amount: number;
    method: "MERCADO_PAGO" | "CASH" | "TRANSFER";
    status: "COMPLETED" | "PENDING";
  }) => void;
  onCancel?: () => void;
  onGenerateLink?: (amount: number) => void;
}) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"MERCADO_PAGO" | "CASH" | "TRANSFER">("CASH");
  const [paymentStatus, setPaymentStatus] = useState<"COMPLETED" | "PENDING">("COMPLETED");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const completedAmount = payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const maxAmount = Number(totalPrice) - completedAmount;

  return (
    <div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-border">
      <p className="text-sm font-medium">Nuevo Pago</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Monto</Label>
          <Input
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            max={maxAmount}
            min="0"
            step="100"
            className="h-8 rounded-lg border border-input bg-background text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Método</Label>
          <Select
            value={paymentMethod}
            onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
          >
            <SelectTrigger className="h-8 rounded-lg border border-input bg-background">
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

      {paymentMethod !== "MERCADO_PAGO" && (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              checked={paymentStatus === "COMPLETED"}
              onChange={() => setPaymentStatus("COMPLETED")}
            />
            Completado
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              checked={paymentStatus === "PENDING"}
              onChange={() => setPaymentStatus("PENDING")}
            />
            Pendiente
          </label>
        </div>
      )}

      {paymentMethod === "MERCADO_PAGO" && (
        <Button
          size="sm"
          onClick={() => setIsGeneratingLink(true)}
          disabled={!paymentAmount || Number(paymentAmount) <= 0}
          className="h-8"
        >
          {isGeneratingLink ? "Generando..." : "Generar Link de Pago"}
        </Button>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            onSubmit?.({
              amount: Number(paymentAmount),
              method: paymentMethod,
              status: paymentStatus,
            });
          }}
          disabled={
            !paymentAmount ||
            Number(paymentAmount) <= 0 ||
            paymentMethod === "MERCADO_PAGO"
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

export function ReservationDetailMinimal({
  reservation,
  open,
  onClose,
  onCopyLink,
  onRegenerateLink,
  onConfirmPayment,
  onDeletePayment,
  onAddPayment,
}: {
  reservation: Reservation;
  open: boolean;
  onClose: () => void;
  onCopyLink?: (initPoint: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onConfirmPayment?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onAddPayment?: () => void;
}) {
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const nights = getNights(reservation.startDate, reservation.endDate);
  const paidAmount = reservation.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Number(reservation.totalPrice) - paidAmount;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: reservation.property.color }}
            />
            {reservation.property.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{reservation.client.name}</p>
              <p className="text-xs text-muted-foreground">{reservation.client.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Check-in</p>
              <p className="font-medium">{formatDate(reservation.startDate)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Check-out</p>
              <p className="font-medium">{formatDate(reservation.endDate)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Badge variant={status.variant}>{status.label}</Badge>
              {reservation.bookingAirbnb && (
                <Badge variant="outline" className="text-xs">
                  Airbnb
                </Badge>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{nights} noches</span>
          </div>

          <div className="flex items-baseline justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-primary">
              {formatPrice(reservation.totalPrice)}
            </span>
          </div>

          {pendingAmount > 0 && (
            <div className="flex justify-between text-sm p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-muted-foreground">Pagado</p>
                <p className="font-medium text-green-600">{formatPrice(paidAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Pendiente</p>
                <p className="font-medium text-orange-600">{formatPrice(pendingAmount)}</p>
              </div>
            </div>
          )}

          {reservation.notes && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Notas</p>
              <p className="text-sm">{reservation.notes}</p>
            </div>
          )}

          {reservation.payments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pagos</p>
              {reservation.payments.map((payment) => (
                <PaymentItem
                  key={payment.id}
                  payment={payment}
                  onCopyLink={() => payment.initPoint && onCopyLink?.(payment.initPoint)}
                  onRegenerateLink={() => onRegenerateLink?.(payment.id)}
                  onConfirmPayment={() => onConfirmPayment?.(payment.id)}
                  onDeletePayment={() => onDeletePayment?.(payment.id)}
                />
              ))}
            </div>
          )}

          {reservation.status !== "CANCELLED" && (
            <div className="border-t border-border pt-4">
              {!onAddPayment ? (
                <Button variant="outline" size="sm" className="w-full h-8" onClick={onClose}>
                  Cerrar
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReservationDetailEnhanced({
  reservation,
  open,
  onClose,
  onCopyLink,
  onRegenerateLink,
  onConfirmPayment,
  onDeletePayment,
  onAddPayment,
}: {
  reservation: Reservation;
  open: boolean;
  onClose: () => void;
  onCopyLink?: (initPoint: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onConfirmPayment?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onAddPayment?: () => void;
}) {
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const nights = getNights(reservation.startDate, reservation.endDate);
  const paidAmount = reservation.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Number(reservation.totalPrice) - paidAmount;
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: reservation.property.color }}
              >
                {reservation.property.name[0]}
              </div>
              <div>
                <p className="font-medium">{reservation.property.name}</p>
                <p className="text-sm text-muted-foreground font-normal">
                  Reserva #{reservation.id.slice(0, 8)}
                </p>
              </div>
            </DialogTitle>
            <Badge variant={status.variant} className="h-6">
              {status.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{reservation.client.name}</p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {reservation.client.email}
                </span>
                {reservation.client.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {reservation.client.phone}
                  </span>
                )}
              </div>
            </div>
            {reservation.bookingAirbnb && (
              <Badge variant="outline" className="h-6">
                Airbnb
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">Check-in</p>
              <p className="font-medium text-sm">{formatDate(reservation.startDate)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">Check-out</p>
              <p className="font-medium text-sm">{formatDate(reservation.endDate)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">Duración</p>
              <p className="font-medium text-sm">{nights} noches</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
            <div>
              <p className="text-sm text-muted-foreground">
                {reservation.billingType === "DAILY" ? "Tarifa diaria" : "Tarifa mensual"}
              </p>
              <p className="text-xs text-muted-foreground">
                {reservation.unitsBooked} × {nights} noches
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                {formatPrice(reservation.totalPrice)}
              </p>
              {pendingAmount > 0 && (
                <p className="text-sm text-orange-600">
                  {formatPrice(pendingAmount)} pendiente
                </p>
              )}
            </div>
          </div>

          {reservation.notes && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Notas de la reserva</p>
              <p className="text-sm">{reservation.notes}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Historial de pagos</p>
              {reservation.status !== "CANCELLED" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowPaymentForm(!showPaymentForm)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {showPaymentForm ? "Cancelar" : "Registrar Pago"}
                </Button>
              )}
            </div>

            {showPaymentForm && (
              <PaymentForm
                totalPrice={reservation.totalPrice}
                payments={reservation.payments}
                onCancel={() => setShowPaymentForm(false)}
                onSubmit={(data) => {
                  onAddPayment?.();
                  setShowPaymentForm(false);
                }}
              />
            )}

            {reservation.payments.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-border text-center">
                <p className="text-sm text-muted-foreground">Sin pagos registrados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reservation.payments.map((payment) => (
                  <PaymentItem
                    key={payment.id}
                    payment={payment}
                    onCopyLink={() => payment.initPoint && onCopyLink?.(payment.initPoint)}
                    onRegenerateLink={() => onRegenerateLink?.(payment.id)}
                    onConfirmPayment={() => onConfirmPayment?.(payment.id)}
                    onDeletePayment={() => onDeletePayment?.(payment.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button variant="outline" className="flex-1 h-8">
            Editar
          </Button>
          {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
            <Button variant="destructive" className="h-8">
              Cancelar Reserva
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReservationDetailTimeline({
  reservation,
  open,
  onClose,
  onCopyLink,
  onRegenerateLink,
  onConfirmPayment,
  onDeletePayment,
  onAddPayment,
}: {
  reservation: Reservation;
  open: boolean;
  onClose: () => void;
  onCopyLink?: (initPoint: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onConfirmPayment?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onAddPayment?: () => void;
}) {
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const nights = getNights(reservation.startDate, reservation.endDate);
  const paidAmount = reservation.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Number(reservation.totalPrice) - paidAmount;
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
              style={{ backgroundColor: reservation.property.color }}
            >
              {reservation.property.name[0]}
            </div>
            <div>
              <DialogTitle className="text-xl">{reservation.property.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Reserva #{reservation.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reservation.bookingAirbnb && (
              <Badge variant="outline" className="h-6">
                Airbnb
              </Badge>
            )}
            <Badge variant={status.variant} className="h-6 text-sm">
              {status.label}
            </Badge>
          </div>
        </div>

        <div className="flex gap-6 mb-6">
          <div className="flex-1 p-4 rounded-xl bg-muted/30 border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              Período
            </div>
            <p className="text-lg font-bold">
              {formatDate(reservation.startDate)}
            </p>
            <p className="text-sm text-muted-foreground">hasta</p>
            <p className="text-lg font-bold">
              {formatDate(reservation.endDate)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{nights} noches</p>
          </div>

          <div className="flex-1 p-4 rounded-xl bg-muted/30 border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <User className="h-4 w-4" />
              Huésped
            </div>
            <p className="font-bold">{reservation.client.name}</p>
            <p className="text-sm text-muted-foreground">
              {reservation.client.email}
            </p>
            {reservation.client.phone && (
              <p className="text-sm text-muted-foreground">
                {reservation.client.phone}
              </p>
            )}
          </div>

          <div className="flex-1 p-4 rounded-xl bg-primary/5 border-2 border-primary/20 text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {reservation.billingType === "DAILY" ? "Tarifa diaria" : "Tarifa mensual"}
            </p>
            <p className="text-2xl font-bold text-primary">
              {formatPrice(reservation.totalPrice)}
            </p>
            {pendingAmount > 0 && (
              <p className="text-sm text-orange-600 mt-1">
                {formatPrice(pendingAmount)} pend.
              </p>
            )}
          </div>
        </div>

        {reservation.notes && (
          <div className="p-4 rounded-xl bg-muted/50 border border-border mb-6">
            <p className="text-sm font-medium mb-1">Notas</p>
            <p className="text-sm text-muted-foreground">{reservation.notes}</p>
          </div>
        )}

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">
              Pagos ({reservation.payments.length})
            </p>
            {reservation.status !== "CANCELLED" && (
              <Button
                size="sm"
                variant={showPaymentForm ? "ghost" : "outline"}
                className="h-7"
                onClick={() => setShowPaymentForm(!showPaymentForm)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {showPaymentForm ? "Cancelar" : "Agregar"}
              </Button>
            )}
          </div>

          {showPaymentForm && (
            <div className="mb-4">
              <PaymentForm
                totalPrice={reservation.totalPrice}
                payments={reservation.payments}
                onCancel={() => setShowPaymentForm(false)}
                onSubmit={(data) => {
                  onAddPayment?.();
                  setShowPaymentForm(false);
                }}
              />
            </div>
          )}

          <div className="space-y-2">
            {reservation.payments.map((payment, index) => (
              <PaymentItem
                key={payment.id}
                payment={payment}
                onCopyLink={() => payment.initPoint && onCopyLink?.(payment.initPoint)}
                onRegenerateLink={() => onRegenerateLink?.(payment.id)}
                onConfirmPayment={() => onConfirmPayment?.(payment.id)}
                onDeletePayment={() => onDeletePayment?.(payment.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" className="flex-1 h-9">
            Editar Reserva
          </Button>
          {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
            <Button variant="destructive" className="h-9">
              Cancelar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReservationDetailShowcase() {
  const [showMinimal, setShowMinimal] = useState(false);
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const handleCopyLink = (initPoint: string) => {
    navigator.clipboard.writeText(initPoint);
  };

  const handleRegenerateLink = (paymentId: string) => {
    console.log("Regenerate link for payment:", paymentId);
  };

  const handleConfirmPayment = (paymentId: string) => {
    console.log("Confirm payment:", paymentId);
  };

  const handleDeletePayment = (paymentId: string) => {
    console.log("Delete payment:", paymentId);
  };

  const handleAddPayment = () => {
    console.log("Add payment");
  };

  return (
    <div className="space-y-16 p-8 bg-background min-h-screen">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
          Reservation Detail Modal Prototypes
        </h1>
        <p className="text-muted-foreground mt-2">
          Variantes de modales de detalle siguiendo DESIGN.md tokens
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Button onClick={() => setShowMinimal(true)}>Minimal</Button>
        <Button onClick={() => setShowEnhanced(true)}>Enhanced</Button>
        <Button onClick={() => setShowTimeline(true)}>Timeline</Button>
      </div>

      <ReservationDetailMinimal
        reservation={mockReservation}
        open={showMinimal}
        onClose={() => setShowMinimal(false)}
        onCopyLink={handleCopyLink}
        onRegenerateLink={handleRegenerateLink}
        onConfirmPayment={handleConfirmPayment}
        onDeletePayment={handleDeletePayment}
        onAddPayment={handleAddPayment}
      />
      <ReservationDetailEnhanced
        reservation={mockReservation}
        open={showEnhanced}
        onClose={() => setShowEnhanced(false)}
        onCopyLink={handleCopyLink}
        onRegenerateLink={handleRegenerateLink}
        onConfirmPayment={handleConfirmPayment}
        onDeletePayment={handleDeletePayment}
        onAddPayment={handleAddPayment}
      />
      <ReservationDetailTimeline
        reservation={mockReservation}
        open={showTimeline}
        onClose={() => setShowTimeline(false)}
        onCopyLink={handleCopyLink}
        onRegenerateLink={handleRegenerateLink}
        onConfirmPayment={handleConfirmPayment}
        onDeletePayment={handleDeletePayment}
        onAddPayment={handleAddPayment}
      />

      <hr className="border-border" />

      <div className="space-y-8">
        <h2 className="text-lg font-medium text-muted-foreground">
          Funcionalidades incluidas
        </h2>

        <section>
          <h3 className="text-base font-medium mb-3">Acciones de Pago</h3>
          <div className="p-6 bg-muted/30 rounded-xl max-w-2xl">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-2">
              <li>
                <strong>Copiar Link:</strong> Para pagos Mercado Pago pendientes con
                initPoint
              </li>
              <li>
                <strong>Regenerar Link:</strong> Para pagos expirados de Mercado Pago
              </li>
              <li>
                <strong>Confirmar Pago:</strong> Para pagos no-Mercado Pago en estado
                Pendiente
              </li>
              <li>
                <strong>Eliminar Pago:</strong> Con opción de deshacer
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h3 className="text-base font-medium mb-3">Formulario de Registro</h3>
          <div className="p-6 bg-muted/30 rounded-xl max-w-2xl">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-2">
              <li>Monto con máximo basado en pendiente</li>
              <li>
                Método: Efectivo, Transferencia, Mercado Pago
              </li>
              <li>Estado: Completado o Pendiente (para no-MP)</li>
              <li>Generación de link para Mercado Pago</li>
            </ul>
          </div>
        </section>

        <section>
          <h3 className="text-base font-medium mb-3">Tokens DESIGN.md usados</h3>
          <div className="p-6 bg-muted/30 rounded-xl max-w-2xl">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-2">
              <li>
                <strong>Dialog:</strong> max-w-sm/md/lg/2xl, rounded-xl, p-4
              </li>
              <li>
                <strong>Badges:</strong> h-6, variant default/secondary/destructive
              </li>
              <li>
                <strong>Botones:</strong> h-7, h-8, h-9 con tamaños sm/default
              </li>
              <li>
                <strong>Payments:</strong> bg-green-100 dark:bg-green-900/30, bg-orange-100
                dark:bg-orange-900/30
              </li>
              <li>
                <strong>Cards:</strong> bg-muted/30, border border-border
              </li>
              <li>
                <strong>Highlight:</strong> border-2 border-primary/20, bg-primary/5
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
