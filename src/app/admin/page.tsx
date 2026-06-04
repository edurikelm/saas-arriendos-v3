import Link from "next/link";
import { Shield, Users, Building2, DollarSign, Calendar, ArrowRight, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSystemStats, getRecentOwners } from "@/lib/actions/super-admin";

export default async function AdminDashboardPage() {
  const [stats, recentOwners] = await Promise.all([
    getSystemStats(),
    getRecentOwners(5),
  ]);

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">No autorizado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Panel de gestión del sistema</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Propietarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">usuarios registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Propiedades</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProperties}</div>
            <p className="text-xs text-muted-foreground">propiedades en el sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reservas Totales</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReservations}</div>
            <p className="text-xs text-muted-foreground">reservas realizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(stats.totalRevenue).toLocaleString("CLP")}
            </div>
            <p className="text-xs text-muted-foreground">pagos completados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Propietarios Recientes</CardTitle>
                <CardDescription>Últimos 5 propietarios registrados</CardDescription>
              </div>
              <Button variant="outline" size="sm" render={
                <Link href="/admin/users" className="flex items-center">
                  Ver todos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              } />
            </div>
          </CardHeader>
          <CardContent>
            {recentOwners.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay propietarios registrados</p>
            ) : (
              <div className="space-y-4">
                {recentOwners.map((owner) => (
                  <div key={owner.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {owner.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">{owner._count.properties} propiedades</p>
                        <p className="text-xs text-muted-foreground">
                          {owner._count.reservations} reservas
                        </p>
                      </div>
                      <Badge
                        variant={
                          owner.plan === "PRO"
                            ? "default"
                            : owner.plan === "FREE"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {owner.plan || "SIN PLAN"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>Operaciones comunes del administrador</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" render={
              <Link href="/admin/users" className="flex items-center">
                <Users className="mr-2 h-4 w-4" />
                Gestionar Usuarios
              </Link>
            } />
            <Button className="w-full justify-start" variant="outline" render={
              <Link href="/admin/users" className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Crear Nuevo Propietario
              </Link>
            } />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}