import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PAYMENT_METHOD_LABELS, type ReservationDetail, type PropertySummary } from "./excel";

/**
 * No hay límite de filas: `jspdf-autotable` pagina el cuerpo de la tabla
 * automáticamente (una tabla de 250 filas produce ~8 páginas), así que no
 * hay truncamiento silencioso que proteger. Un límite anterior de 100 filas
 * lanzaba `ExportDetailsLimitError` antes de intentar renderizar — medido:
 * innecesario, ver `src/lib/export-utils/__tests__/pdf.test.ts` (250 filas,
 * multi-página, sin excepción). Se retiró junto con esa clase.
 */
export function exportToPDF(
  details: ReservationDetail[],
  summaries: PropertySummary[],
  dateRange: { from: Date; to: Date } | null,
  cashByMethod?: Record<string, number>
) {
  const doc = new jsPDF();

  const title = dateRange
    ? `Reporte: ${dateRange.from.toLocaleDateString("es-CL")} - ${dateRange.to.toLocaleDateString("es-CL")}`
    : "Reporte de Reservaciones";

  doc.setFontSize(18);
  doc.text(title, 14, 20);

  doc.setFontSize(12);
  doc.text("Resumen por Propiedad", 14, 35);

  autoTable(doc, {
    startY: 40,
    head: [["Propiedad", "Reservas", "Noches", "Total Reservado", "Cobrado", "Pendiente"]],
    body: summaries.map((s) => [
      s.propertyName,
      s.totalReservations.toString(),
      s.totalNights.toString(),
      (s.reservedRevenueInRange ?? s.totalRevenue ?? 0).toLocaleString("CLP"),
      s.paidRevenue.toLocaleString("CLP"),
      s.pendingRevenue.toLocaleString("CLP"),
    ]),
    foot: [
      [
        "TOTAL",
        summaries.reduce((acc, s) => acc + s.totalReservations, 0).toString(),
        summaries.reduce((acc, s) => acc + s.totalNights, 0).toString(),
        summaries.reduce((acc, s) => acc + (s.reservedRevenueInRange ?? s.totalRevenue ?? 0), 0).toLocaleString("CLP"),
        summaries.reduce((acc, s) => acc + s.paidRevenue, 0).toLocaleString("CLP"),
        summaries.reduce((acc, s) => acc + s.pendingRevenue, 0).toLocaleString("CLP"),
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: "bold" },
  });

  const getFinalY = (fallback: number) =>
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;

  let finalY = getFinalY(40);

  if (cashByMethod) {
    const methodEntries = Object.entries(cashByMethod);
    const totalByMethod = methodEntries.reduce((acc, [, amount]) => acc + amount, 0);

    doc.text("Por método de pago", 14, finalY + 15);

    autoTable(doc, {
      startY: finalY + 20,
      head: [["Método", "Cobrado"]],
      body: methodEntries.map(([method, amount]) => [
        PAYMENT_METHOD_LABELS[method] ?? method,
        amount.toLocaleString("CLP"),
      ]),
      foot: [["TOTAL", totalByMethod.toLocaleString("CLP")]],
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: "bold" },
    });

    finalY = getFinalY(finalY);
  }

  doc.text("Detalle de Reservaciones", 14, finalY + 15);

  autoTable(doc, {
    startY: finalY + 20,
    head: [["Propiedad", "Cliente", "Inicio", "Fin", "Total", "Estado", "Pago"]],
    body: details.map((d) => [
      d.propertyName.substring(0, 15),
      d.clientName.substring(0, 20),
      d.startDate.toLocaleDateString("es-CL"),
      d.endDate.toLocaleDateString("es-CL"),
      d.totalPrice.toLocaleString("CLP"),
      d.status,
      d.paymentStatus,
    ]),
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save("reporte.pdf");
}