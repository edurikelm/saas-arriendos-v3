import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReservationDetail, PropertySummary } from "./excel";

export function exportToPDF(
  details: ReservationDetail[],
  summaries: PropertySummary[],
  dateRange: { from: Date; to: Date } | null
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
    head: [["Propiedad", "Reservas", "Noches", "Total", "Pagado", "Pendiente"]],
    body: summaries.map((s) => [
      s.propertyName,
      s.totalReservations.toString(),
      s.totalNights.toString(),
      s.totalRevenue.toLocaleString("CLP"),
      s.paidRevenue.toLocaleString("CLP"),
      s.pendingRevenue.toLocaleString("CLP"),
    ]),
    foot: [
      [
        "TOTAL",
        summaries.reduce((acc, s) => acc + s.totalReservations, 0).toString(),
        summaries.reduce((acc, s) => acc + s.totalNights, 0).toString(),
        summaries.reduce((acc, s) => acc + s.totalRevenue, 0).toLocaleString("CLP"),
        summaries.reduce((acc, s) => acc + s.paidRevenue, 0).toLocaleString("CLP"),
        summaries.reduce((acc, s) => acc + s.pendingRevenue, 0).toLocaleString("CLP"),
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: "bold" },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 40;

  doc.text("Detalle de Reservaciones", 14, finalY + 15);

  autoTable(doc, {
    startY: finalY + 20,
    head: [["Propiedad", "Cliente", "Inicio", "Fin", "Total", "Estado", "Pago"]],
    body: details.slice(0, 100).map((d) => [
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