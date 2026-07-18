/**
 * Comprobante PDF para pagos de RentalPro.
 *
 * Renderizado server-side con @react-pdf/renderer.
 * No incluye logos binarios — solo texto y layout.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 12,
  },
  headerBrand: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0d9488",
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 2,
  },
  receiptNumber: {
    fontSize: 9,
    color: "#374151",
    textAlign: "right",
  },
  receiptLabel: {
    fontSize: 7,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  rowLabel: {
    color: "#6b7280",
    fontSize: 9,
  },
  rowValue: {
    color: "#1a1a1a",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  rowValueNormal: {
    color: "#1a1a1a",
    fontSize: 9,
    textAlign: "right",
  },
  highlightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    backgroundColor: "#f0fdfa",
    borderRadius: 4,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  highlightLabel: {
    color: "#0d9488",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  highlightValue: {
    color: "#0d9488",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  mpSection: {
    marginBottom: 16,
    backgroundColor: "#fafafa",
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  mpTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#009ee3",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  col: {
    flex: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    marginVertical: 8,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
  },
  nightsBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  nightsText: {
    fontSize: 8,
    color: "#92400e",
    fontFamily: "Helvetica-Bold",
  },
});

function formatCLP(amount: number | string): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: es });
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy HH:mm", { locale: es });
}

function getNights(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export interface PaymentReceiptData {
  id: string;
  amount: number;
  paidAt: Date | string | null;
  method: string;
  mpPaymentId?: string | null;
  mpStatusDetail?: string | null;
  mpPaymentMethodId?: string | null;
  mpPaymentType?: string | null;
  mpCardLastFour?: string | null;
  mpInstallments?: number | null;
  mpTransactionAmount?: number | null;
  mpNetReceivedAmount?: number | null;
  mpFeeAmount?: number | null;
  mpDateCreated?: Date | string | null;
  reservation: {
    id: string;
    startDate: Date | string;
    endDate: Date | string;
    billingType: string;
    totalPrice: number;
    client: { name: string; email?: string | null; phone?: string | null };
    property: { name: string; address?: string | null };
  };
}

export interface PaymentReceiptProps {
  payment: PaymentReceiptData;
  /** Unix timestamp (seconds) of paidAt — computed by the caller to keep component pure. */
  paidAtUnix: number;
}

export function PaymentReceipt({ payment, paidAtUnix }: PaymentReceiptProps) {
  const nights =
    payment.reservation.billingType === "DAILY"
      ? getNights(payment.reservation.startDate, payment.reservation.endDate)
      : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerBrand}>RENTALPRO</Text>
            <Text style={styles.headerSub}>Comprobante de pago</Text>
          </View>
          <View>
            <Text style={styles.receiptLabel}>Comprobante N°</Text>
            <Text style={styles.receiptNumber}>{payment.id}</Text>
            <Text style={styles.receiptNumber}>
              {formatDateTime(payment.paidAt)}
            </Text>
          </View>
        </View>

        {/* Datos del Pago */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Pago</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Monto pagado</Text>
            <Text style={styles.highlightValue}>{formatCLP(payment.amount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Estado</Text>
            <Text style={styles.rowValue}>COMPLETADO</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Método</Text>
            <Text style={styles.rowValueNormal}>
              {payment.method === "MERCADO_PAGO" ? "Mercado Pago" : payment.method}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Fecha de pago</Text>
            <Text style={styles.rowValueNormal}>{formatDate(payment.paidAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>ID interno</Text>
            <Text style={styles.rowValueNormal}>{payment.id}</Text>
          </View>
        </View>

        {/* Mercado Pago Fields — only show if MP payment */}
        {payment.method === "MERCADO_PAGO" && (
          <View style={styles.mpSection}>
            <Text style={styles.mpTitle}>Detalle Mercado Pago</Text>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>ID Pago MP</Text>
                  <Text style={styles.rowValueNormal}>{payment.mpPaymentId ?? "—"}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Tipo</Text>
                  <Text style={styles.rowValueNormal}>{payment.mpPaymentType ?? "—"}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Método</Text>
                  <Text style={styles.rowValueNormal}>{payment.mpPaymentMethodId ?? "—"}</Text>
                </View>
                {payment.mpCardLastFour && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Últimos 4 dígitos</Text>
                    <Text style={styles.rowValueNormal}>•••• {payment.mpCardLastFour}</Text>
                  </View>
                )}
              </View>
              <View style={styles.col}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Cuotas</Text>
                  <Text style={styles.rowValueNormal}>
                    {payment.mpInstallments != null ? `${payment.mpInstallments}` : "—"}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Monto transacción</Text>
                  <Text style={styles.rowValueNormal}>
                    {payment.mpTransactionAmount != null
                      ? formatCLP(payment.mpTransactionAmount)
                      : "—"}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Neto recibido</Text>
                  <Text style={styles.rowValueNormal}>
                    {payment.mpNetReceivedAmount != null
                      ? formatCLP(payment.mpNetReceivedAmount)
                      : "—"}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Comisión MP</Text>
                  <Text style={styles.rowValueNormal}>
                    {payment.mpFeeAmount != null ? formatCLP(payment.mpFeeAmount) : "—"}
                  </Text>
                </View>
              </View>
            </View>
            {payment.mpStatusDetail && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Status detalle</Text>
                  <Text style={styles.rowValueNormal}>{payment.mpStatusDetail}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Datos de la Reserva */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos de la Reserva</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Propiedad</Text>
            <Text style={styles.rowValueNormal}>
              {payment.reservation.property.name}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Cliente</Text>
            <Text style={styles.rowValueNormal}>{payment.reservation.client.name}</Text>
          </View>
          {payment.reservation.client.email && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValueNormal}>{payment.reservation.client.email}</Text>
            </View>
          )}
          {payment.reservation.client.phone && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Teléfono</Text>
              <Text style={styles.rowValueNormal}>{payment.reservation.client.phone}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tipo</Text>
            <Text style={styles.rowValueNormal}>
              {payment.reservation.billingType === "DAILY"
                ? "Diario"
                : "Mensual"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Fechas</Text>
            <Text style={styles.rowValueNormal}>
              {formatDate(payment.reservation.startDate)} —{" "}
              {formatDate(payment.reservation.endDate)}
            </Text>
          </View>
          {nights != null && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Noches</Text>
              <View style={styles.nightsBadge}>
                <Text style={styles.nightsText}>{nights} noche{nights !== 1 ? "s" : ""}</Text>
              </View>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total reserva</Text>
            <Text style={styles.rowValue}>{formatCLP(payment.reservation.totalPrice)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Comprobante interno — generado por RentalPro
          </Text>
          <Text style={styles.footerText}>
            {payment.reservation.id} · {paidAtUnix}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
