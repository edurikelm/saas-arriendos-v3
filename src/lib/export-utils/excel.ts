import * as XLSX from "xlsx";

export interface ReservationDetail {
  id: string;
  propertyName: string;
  clientName: string;
  clientEmail: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: string;
  paymentStatus: string;
  createdAt: Date;
}

export interface PropertySummary {
  propertyName: string;
  totalReservations: number;
  totalNights: number;
  totalRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
}

export function exportToExcel(
  details: ReservationDetail[],
  summaries: PropertySummary[],
  dateRange: { from: Date; to: Date } | null
) {
  const workbook = XLSX.utils.book_new();

  const detailSheet = XLSX.utils.json_to_sheet(
    details.map((d) => ({
      "Propiedad": d.propertyName,
      "Cliente": d.clientName,
      "Email": d.clientEmail,
      "Inicio": d.startDate.toLocaleDateString("es-CL"),
      "Fin": d.endDate.toLocaleDateString("es-CL"),
      "Noches": Math.ceil(
        (d.endDate.getTime() - d.startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1,
      "Total": d.totalPrice,
      "Estado Reserva": d.status,
      "Estado Pago": d.paymentStatus,
      "Fecha Creación": d.createdAt.toLocaleDateString("es-CL"),
    }))
  );
  detailSheet["!cols"] = [
    { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 12 },
    { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(
    summaries.map((s) => ({
      "Propiedad": s.propertyName,
      "Reservas": s.totalReservations,
      "Noches": s.totalNights,
      "Ingresos Totales": s.totalRevenue,
      "Pagado": s.paidRevenue,
      "Pendiente": s.pendingRevenue,
    }))
  );
  summarySheet["!cols"] = [
    { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(workbook, detailSheet, "Detalle");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen por Propiedad");

  const rangeLabel = dateRange
    ? `_${dateRange.from.toLocaleDateString("es-CL").replace(/\//g, "-")}_a_${dateRange.to.toLocaleDateString("es-CL").replace(/\//g, "-")}`
    : "";

  XLSX.writeFile(workbook, `reporte${rangeLabel}.xlsx`);
}