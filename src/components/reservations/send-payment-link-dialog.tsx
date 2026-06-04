"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle, Mail, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Payment {
  id: string;
  installmentIndex?: number;
  amount: string;
  dueDate?: string | null;
  status: string;
  method: string;
  initPoint?: string | null;
  title?: string | null;
}

interface Client {
  name: string;
  email: string;
  phone?: string;
}

interface SendPaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
  client: Client;
  propertyName: string;
  billingType: string;
}

function formatAmount(amount: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatMonthYear(dateString: string): string {
  return format(new Date(dateString), "MMMM yyyy", { locale: es });
}

function getDefaultTemplate(params: {
  clientName: string;
  propertyName: string;
  amount: string;
  dueDate?: string | null;
  month?: string;
  link: string;
  installmentIndex?: number;
  title?: string | null;
  billingType: string;
}): string {
  const { clientName, propertyName, amount, dueDate, month, link, installmentIndex, title, billingType } = params;
  
  const concepto = title || (billingType === "MONTHLY" && installmentIndex ? `Cuota ${installmentIndex} - Arriendo ${propertyName}` : `Pago ${propertyName}`);
  
  let template = `¡Hola ${clientName}! Te enviamos el link de pago para tu reserva en ${propertyName}.\n\n`;
  template += `Concepto: ${concepto}\n`;
  template += `Monto: ${amount}`;
  
  if (dueDate) {
    template += `\nVencimiento: ${format(new Date(dueDate), "d MMM yyyy", { locale: es })}`;
  } else if (month) {
    template += `\nCorrespondiente a: ${month}`;
  }
  
  template += `\n\nLink de pago: ${link}`;
  
  return template;
}

function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

function buildMailtoLink(email: string, subject: string, body: string): string {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
}

export function SendPaymentLinkDialog({
  open,
  onOpenChange,
  payment,
  client,
  propertyName,
  billingType,
}: SendPaymentLinkDialogProps) {
  const [message, setMessage] = useState(() =>
    payment && payment.initPoint
      ? getDefaultTemplate({
          clientName: client.name,
          propertyName,
          amount: formatAmount(payment.amount),
          dueDate: payment.dueDate,
          month: payment.dueDate ? formatMonthYear(payment.dueDate) : undefined,
          link: payment.initPoint || "",
          installmentIndex: payment.installmentIndex,
          title: payment.title,
          billingType,
        })
      : ""
  );
  const [copied, setCopied] = useState(false);

  if (!payment || !payment.initPoint) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!client.phone) {
      alert("El cliente no tiene número de teléfono registrado");
      return;
    }
    window.open(buildWhatsAppLink(client.phone, message), "_blank");
  };

  const handleEmail = () => {
    const subject = `Link de pago - ${propertyName}`;
    window.open(buildMailtoLink(client.email, subject, message), "_blank");
  };

  const canSendWhatsApp = Boolean(client.phone);
  const canSendEmail = Boolean(client.email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar link de pago</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Mensaje</label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="mr-1 size-3" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 size-3" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[200px] text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleWhatsApp}
              disabled={!canSendWhatsApp}
              title={!canSendWhatsApp ? "Cliente sin teléfono" : undefined}
            >
              <MessageCircle className="mr-2 size-4" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleEmail}
              disabled={!canSendEmail}
              title={!canSendEmail ? "Cliente sin email" : undefined}
            >
              <Mail className="mr-2 size-4" />
              Email
            </Button>
          </div>

          {(!canSendWhatsApp || !canSendEmail) && (
            <p className="text-xs text-muted-foreground text-center">
              {!canSendWhatsApp && !canSendEmail && "El cliente no tiene contacto registrado"}
              {!canSendWhatsApp && canSendEmail && "Cliente sin número de WhatsApp"}
              {canSendWhatsApp && !canSendEmail && "Cliente sin email registrado"}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}