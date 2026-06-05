import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Users, Calendar, DollarSign, CreditCard, AlertTriangle, CheckCircle2, XCircle, UserCircle, LayoutList, UserPlus, CalendarCheck, Receipt, Banknote, Link2, Ban, RotateCcw, XCircleIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getOwnerDetail } from "@/lib/actions/admin-users";
import { AdminOwnerNotes } from "@/components/admin/admin-owner-notes";
import { ActionHistory } from "@/components/admin/action-history";
import { updateUserStatus } from "@/lib/actions/super-admin";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getOwnerDetail(id);

  if (!data) {
    notFound();
  }

  const { owner, stats, properties, reservations, payments } = data;

  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isAtLimit = owner.plan === "FREE" && stats.properties >= stats.propertiesLimit;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" render={<Link href="/admin/users" />}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{owner.name || "Sin nombre"}</CardTitle>
                <CardDescription>{owner.email}</CardDescription>
              </div>
              <Badge variant={owner.plan === "PRO" ? "secondary" : "outline"}>
                {owner.plan}
              </Badge>
              <Badge
                variant={
                  owner.status === "ACTIVE"
                    ? "default"
                    : owner.status === "SUSPENDED"
                    ? "secondary"
                    : "destructive"
                }
              >
                {owner.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50">
                <Building2 className="h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{stats.properties}</p>
                <p className="text-xs text-muted-foreground">Propiedades</p>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50">
                <Users className="h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{stats.clients}</p>
                <p className="text-xs text-muted-foreground">Clientes</p>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50">
                <Calendar className="h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{stats.reservations}</p>
                <p className="text-xs text-muted-foreground">Reservas</p>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50">
                <DollarSign className="h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{formatCLP(stats.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Ingresos</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                {stats.hasMpIntegration ? (
                  stats.isMpConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Mercado Pago Conectado</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Mercado Pago Inactivo</span>
                    </>
                  )
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Mercado Pago No Configurado</span>
                  </>
                )}
              </div>

              {owner.plan === "FREE" && (
                <div className="flex items-center gap-2">
                  {isAtLimit ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">
                        Al límite ({stats.properties}/{stats.propertiesLimit} propiedades)
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {stats.properties}/{stats.propertiesLimit} propiedades usadas
                    </span>
                  )}
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Creado el {formatDate(owner.createdAt)}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {owner.status !== "ACTIVE" && (
                  <form action={async () => {
                    "use server";
                    await updateUserStatus({ userId: owner.id, status: "ACTIVE" });
                  }}>
                    <Button variant="default" size="sm" type="submit">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reactivar
                    </Button>
                  </form>
                )}
                {owner.status !== "SUSPENDED" && (
                  <form action={async () => {
                    "use server";
                    await updateUserStatus({ userId: owner.id, status: "SUSPENDED" });
                  }}>
                    <Button variant="secondary" size="sm" type="submit">
                      <Ban className="h-4 w-4 mr-2" />
                      Suspender
                    </Button>
                  </form>
                )}
                {owner.status !== "CANCELLED" && (
                  <form action={async () => {
                    "use server";
                    await updateUserStatus({ userId: owner.id, status: "CANCELLED" });
                  }}>
                    <Button variant="outline" size="sm" type="submit">
                      <XCircleIcon className="h-4 w-4 mr-2" />
                      Cancelar cuenta
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Resumen Financiero
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pagado</span>
              <span className="font-semibold text-green-600">{formatCLP(stats.paidAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pendiente</span>
              <span className="font-semibold text-yellow-600">{formatCLP(stats.pendingAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Vencido</span>
              <span className="font-semibold text-red-600">{formatCLP(stats.overdueAmount)}</span>
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="text-sm font-medium">Total</span>
              <span className="font-bold">{formatCLP(stats.totalRevenue)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="propiedades">Propiedades</TabsTrigger>
          <TabsTrigger value="reservas">Reservas</TabsTrigger>
          <TabsTrigger value="financiero">Financiero</TabsTrigger>
          <TabsTrigger value="notas">Notas internas</TabsTrigger>
          <TabsTrigger value="onboarding">Progreso</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Plan actual</p>
                  <p className="font-medium">{owner.plan || "FREE"}</p>
                </div>
                {owner.plan === "FREE" && (
                  <div>
                    <p className="text-sm text-muted-foreground">Límite de propiedades</p>
                    <p className="font-medium">
                      {stats.properties} / {stats.propertiesLimit}
                      {isAtLimit && (
                        <Badge variant="destructive" className="ml-2">Al límite</Badge>
                      )}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Total de clientes</p>
                  <p className="font-medium">{stats.clients}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de reservas</p>
                  <p className="font-medium">{stats.reservations}</p>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-2">Integración Mercado Pago</p>
                {stats.hasMpIntegration ? (
                  stats.isMpConnected ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Conectado y activo</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Cuenta conectada pero inactiva</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>No configurado</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="propiedades" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Propiedades ({properties.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay propiedades registradas</p>
              ) : (
                <div className="space-y-4">
                  {properties.map((property) => (
                    <div
                      key={property.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: property.color }}
                        />
                        <div>
                          <p className="font-medium">{property.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {property.unitsAvailable} unidades · {formatCLP(Number(property.dailyPrice))}/noche
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {property._count.reservations} reservas
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Reservas ({reservations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {reservations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay reservas</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left text-sm font-medium">Cliente</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Propiedad</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Fechas</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Total</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Pagado</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((reservation) => (
                        <tr key={reservation.id} className="border-b">
                          <td className="px-4 py-3">{reservation.client.name}</td>
                          <td className="px-4 py-3">{reservation.property.name}</td>
                          <td className="px-4 py-3">
                            {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                          </td>
                          <td className="px-4 py-3">{formatCLP(Number(reservation.totalPrice))}</td>
                          <td className="px-4 py-3">{formatCLP(reservation.paidAmount)}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                reservation.status === "CONFIRMED"
                                  ? "default"
                                  : reservation.status === "PENDING"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {reservation.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financiero" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pagos ({payments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay pagos</p>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{formatCLP(Number(payment.amount))}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.method} · {payment.dueDate ? `Vence: ${formatDate(payment.dueDate)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {payment.isOverdue && (
                          <Badge variant="destructive">Vencido</Badge>
                        )}
                        <Badge
                          variant={
                            payment.status === "COMPLETED"
                              ? "default"
                              : payment.status === "PENDING"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-4">Resumen de Ingresos</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pagado</p>
                    <p className="text-xl font-bold text-green-600">{formatCLP(stats.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pendiente</p>
                    <p className="text-xl font-bold text-yellow-600">{formatCLP(stats.pendingAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vencido</p>
                    <p className="text-xl font-bold text-red-600">{formatCLP(stats.overdueAmount)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutList className="h-5 w-5" />
                Progreso de Onboarding
              </CardTitle>
              <CardDescription>
                Seguimiento del proceso de activación del propietario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    step: 1,
                    label: "Cuenta creada",
                    completed: !!owner.id,
                    icon: UserCircle,
                    description: "Perfil de usuario registrado",
                  },
                  {
                    step: 2,
                    label: "Primera propiedad",
                    completed: stats.properties > 0,
                    icon: Building2,
                    description: `${stats.properties} propiedad${stats.properties !== 1 ? "es" : ""} registrada${stats.properties !== 1 ? "s" : ""}`,
                  },
                  {
                    step: 3,
                    label: "Primer cliente",
                    completed: stats.clients > 0,
                    icon: UserPlus,
                    description: `${stats.clients} cliente${stats.clients !== 1 ? "s" : ""} agregado${stats.clients !== 1 ? "s" : ""}`,
                  },
                  {
                    step: 4,
                    label: "Primera reserva",
                    completed: stats.reservations > 0,
                    icon: CalendarCheck,
                    description: `${stats.reservations} reserva${stats.reservations !== 1 ? "s" : ""} creada${stats.reservations !== 1 ? "s" : ""}`,
                  },
                  {
                    step: 5,
                    label: "Primer pago",
                    completed: payments.length > 0,
                    icon: Receipt,
                    description: `${payments.length} pago${payments.length !== 1 ? "s" : ""} registrado${payments.length !== 1 ? "s" : ""}`,
                  },
                  {
                    step: 6,
                    label: "Primer pago completado",
                    completed: payments.some(p => p.status === "COMPLETED" && p.paidAt),
                    icon: Banknote,
                    description: `${payments.filter(p => p.status === "COMPLETED" && p.paidAt).length} pago${payments.filter(p => p.status === "COMPLETED" && p.paidAt).length !== 1 ? "s" : ""} completado${payments.filter(p => p.status === "COMPLETED" && p.paidAt).length !== 1 ? "s" : ""}`,
                  },
                  {
                    step: 7,
                    label: "Mercado Pago conectado",
                    completed: stats.isMpConnected,
                    icon: Link2,
                    description: stats.isMpConnected ? "Integración activa" : (stats.hasMpIntegration ? "Cuenta inactiva" : "No configurado"),
                  },
                ].map(({ step, label, completed, icon: Icon, description }) => (
                  <div key={step} className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      completed ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                    }`}>
                      {completed ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{label}</span>
                        {completed ? (
                          <Badge variant="default" className="bg-green-600">Completado</Badge>
                        ) : (
                          <Badge variant="secondary">Pendiente</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <ActionHistory ownerId={id} />
        </TabsContent>

        <TabsContent value="notas" className="mt-4">
          <AdminOwnerNotes ownerId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}