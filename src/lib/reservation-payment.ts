function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export interface PaymentStatusResult {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  color: string;
  tooltip: string;
}

export function getPaymentStatus({
  paidAmount,
  totalPrice,
  status,
}: {
  paidAmount: number;
  totalPrice: number;
  status: string;
}): PaymentStatusResult {
  if (status === "CANCELLED") {
    return {
      label: "—",
      variant: "outline",
      color: "#EF4444",
      tooltip: `Pagado: ${formatPrice(paidAmount)} / Total: ${formatPrice(totalPrice)}`,
    };
  }

  if (status === "COMPLETED") {
    return {
      label: "Pagado",
      variant: "default",
      color: "#10B981",
      tooltip: `Pagado: ${formatPrice(paidAmount)} / Total: ${formatPrice(totalPrice)}`,
    };
  }

  if (paidAmount === totalPrice || totalPrice === 0) {
    return {
      label: "Pagado",
      variant: "default",
      color: "#10B981",
      tooltip: `Pagado: ${formatPrice(paidAmount)} / Total: ${formatPrice(totalPrice)}`,
    };
  }

  if (paidAmount > 0) {
    return {
      label: "Parcial",
      variant: "secondary",
      color: "#F59E0B",
      tooltip: `Pagado: ${formatPrice(paidAmount)} / Total: ${formatPrice(totalPrice)}`,
    };
  }

  return {
    label: "Pendiente",
    variant: "destructive",
    color: "#EF4444",
    tooltip: `Pagado: ${formatPrice(paidAmount)} / Total: ${formatPrice(totalPrice)}`,
  };
}