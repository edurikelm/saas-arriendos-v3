import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/actions/super-admin";
import { getSuperAdminSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    if (!(await getSuperAdminSession())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const plan = searchParams.get("plan") || undefined;
    const noProperties = searchParams.get("noProperties") === "true";
    const noReservations = searchParams.get("noReservations") === "true";
    const mpDisconnected = searchParams.get("mpDisconnected") === "true";
    const pendingPayments = searchParams.get("pendingPayments") === "true";
    const overduePayments = searchParams.get("overduePayments") === "true";
    const createdFrom = searchParams.get("createdFrom") || undefined;
    const createdTo = searchParams.get("createdTo") || undefined;

    const result = await getAllUsers({
      page: 1,
      limit: 10000,
      search,
      plan,
      noProperties,
      noReservations,
      mpDisconnected,
      pendingPayments,
      overduePayments,
      createdFrom,
      createdTo,
    });

    const headers = ["email", "nombre", "plan", "estado", "propiedades", "reservas", "ingresos", "fecha_creacion"];

    const rows: string[] = [];
    for (const user of result.users) {
      const row = [
        user.email,
        user.name || "",
        user.plan || "",
        user.role,
        user._count.properties.toString(),
        user._count.reservations.toString(),
        "0",
        new Date(user.createdAt).toISOString().split("T")[0],
      ];
      rows.push(row.join(","));
    }

    const csv = [headers.join(","), ...rows].join("\n");

    const date = new Date().toISOString().split("T")[0];
    const filenameParts = [`propietarios-${date}`];
    if (search) filenameParts.push(`search-${search}`);
    if (plan) filenameParts.push(`plan-${plan}`);
    if (noProperties) filenameParts.push("sin-propiedades");
    if (noReservations) filenameParts.push("sin-reservas");
    const filename = `${filenameParts.join("-")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting users:", error);
    return NextResponse.json({ error: "Error al exportar usuarios" }, { status: 500 });
  }
}