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
  const paid = Number(paidAmount);
  const total = Number(totalPrice);

  if (status === "CANCELLED") {
    return {
      label: "—",
      variant: "outline",
      color: "#EF4444",
      tooltip: `Pagado: ${formatPrice(paid)} / Total: ${formatPrice(total)}`,
    };
  }

  if (status === "COMPLETED") {
    return {
      label: "Pagado",
      variant: "default",
      color: "#10B981",
      tooltip: `Pagado: ${formatPrice(paid)} / Total: ${formatPrice(total)}`,
    };
  }

  if (paid >= total || total === 0) {
    return {
      label: "Pagado",
      variant: "default",
      color: "#10B981",
      tooltip: `Pagado: ${formatPrice(paid)} / Total: ${formatPrice(total)}`,
    };
  }

  if (paid > 0) {
    return {
      label: "Parcial",
      variant: "secondary",
      color: "#F59E0B",
      tooltip: `Pagado: ${formatPrice(paid)} / Total: ${formatPrice(total)}`,
    };
  }

  return {
    label: "Pendiente",
    variant: "destructive",
    color: "#EF4444",
    tooltip: `Pagado: ${formatPrice(paid)} / Total: ${formatPrice(total)}`,
  };
}