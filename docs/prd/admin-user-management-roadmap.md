# Admin User Management Roadmap

## Objetivo

Convertir el panel de Super Admin en una herramienta real de gestión, soporte y seguimiento de propietarios que usan RentalPro.

El panel actual permite ver métricas generales, listar propietarios, buscar/filtrar por plan, crear owners, cambiar plan y eliminar usuarios. La siguiente evolución debe enfocarse en visibilidad, soporte operativo, auditoría y control de riesgo.

## Estado Actual

### Ya Implementado

- Dashboard de Super Admin en `/admin`.
- Métricas generales: total usuarios, propiedades, reservas, ingresos.
- Lista de propietarios en `/admin/users` con paginación.
- Búsqueda por nombre/email y filtro por plan.
- Creación de propietarios (`POST /api/admin/users`).
- Cambio de plan (`FREE`/`PRO`).
- Eliminación de propietarios.
- Backend de `AdminNote` y `AdminActionLog` con endpoints.
- Sidebar adaptado para admin.
- Navbar con badge distintivo para `SUPER_ADMIN`.

### Brechas Detectadas

- La UI no expone notas internas ni logs de acciones.
- El detalle del propietario es muy básico (solo conteos y plan).
- La eliminación actual borra datos permanentemente, lo que es riesgoso para auditoría SaaS.
- No hay estado de cuenta: activo, suspendido, cancelado.
- No hay indicadores de salud del propietario.
- No hay filtros avanzados para soporte o gestión comercial.
- El dashboard no muestra métricas de conversión y crecimiento (ya existen en `getDashboardStats` pero no se usan).
- En la UI aparece `ENTERPRISE` en el filtro de plan, pero el schema solo soporta `FREE` y `PRO`.

## Principios

- Priorizar cambios incrementales y verificables.
- Evitar rediseños grandes si se puede avanzar por vertical slices.
- Mantener `SUPER_ADMIN` como único rol administrativo por ahora.
- No agregar multi-tenancy granular hasta que exista una necesidad concreta.
- Preservar datos históricos siempre que sea posible.
- Toda acción sensible debe quedar auditada.

---

## Fase 1: Detalle Completo Del Propietario

### Objetivo
Dar al Super Admin una vista clara de cada propietario sin tener que entrar a la base de datos.

### Alcance
Crear una vista más completa para cada owner, idealmente en una página dedicada:
- Ruta sugerida: `/admin/users/[id]`.
- Mantener el modal actual como resumen rápido o reemplazarlo gradualmente.

### Información A Mostrar
- Nombre, email, plan, fecha de creación.
- Cantidad de propiedades, clientes, reservas.
- Ingresos pagados, pagos pendientes, pagos vencidos.
- Estado de integración Mercado Pago (conectado/desconectado).
- Reservas recientes (últimas 5).
- Propiedades recientes (últimas 5).
- Límite de plan alcanzado (ej: 3 propiedades en FREE).

### Backend Necesario
Extender o crear endpoint: `GET /api/admin/users/[id]`
- Debe devolver perfil, conteos, propiedades, clientes recientes, reservas recientes, resumen financiero, estado de integraciones.

### Criterios De Aceptación
- El admin puede abrir el detalle de un owner.
- La pantalla muestra datos operativos suficientes para entender el uso del propietario.
- No se filtran datos de otros owners salvo para `SUPER_ADMIN`.
- Si el usuario no existe, muestra estado `not-found`.

---

## Fase 2: Notas Internas De Soporte

### Objetivo
Permitir registrar contexto humano sobre cada propietario.

### Estado Actual
El modelo `AdminNote` y el endpoint `/api/admin/notes` ya existen, pero no están conectados a la UI.

### Alcance
Agregar sección "Notas internas" en el detalle del propietario.

### Funciones
- Ver notas existentes (autor + fecha).
- Crear nueva nota.
- Eliminar nota.

### Criterios De Aceptación
- El admin puede agregar una nota a un owner.
- Las notas quedan asociadas al owner correcto.
- Solo `SUPER_ADMIN` puede ver y crear notas.

---

## Fase 3: Historial De Acciones Admin

### Objetivo
Dar trazabilidad sobre acciones sensibles realizadas por admins.

### Estado Actual
Existe `AdminActionLog` y endpoint `/api/admin/action-logs`.

### Alcance
Agregar tab o sección "Historial" en el detalle del owner.

### Acciones A Registrar
- Creación de propietario.
- Cambio de plan (con detalle de plan anterior).
- Suspensión / Reactivación / Cancelación.
- Eliminación, si se mantiene temporalmente.
- Reset de contraseña.

### Mejora Técnica
Mover logging a una función reusable: `logAdminAction({ adminId, targetId, action, details })` para evitar duplicar lógica en handlers.

### Criterios De Aceptación
- Cada cambio sensible queda registrado.
- El historial muestra: acción, admin, fecha, detalles.
- El historial se ve desde el detalle del propietario.

---

## Fase 4: Suspender En Vez De Eliminar

### Objetivo
Evitar pérdida de información crítica y mejorar auditoría.

### Problema Actual
`deleteUser` elimina pagos, cambios de reserva, reservas, clientes, propiedades y usuario. Esto destruye historial financiero.

### Cambio Propuesto
Agregar estado de cuenta al owner.

### Schema Sugerido
```prisma
enum UserStatus {
  ACTIVE
  SUSPENDED
  CANCELLED
}

model UserProfile {
  // ... campos existentes
  status UserStatus @default(ACTIVE)
}
```

### Comportamiento
- `ACTIVE`: usuario puede usar la aplicación normalmente.
- `SUSPENDED`: usuario no puede acceder o queda bloqueado en pantalla de suspensión.
- `CANCELLED`: cuenta cerrada, datos conservados.
- Eliminación dura reservada para casos excepcionales (requeriría confirmación extra).

### UI
- Badge de estado en tabla.
- Acciones: "Suspender", "Reactivar", "Cancelar cuenta".
- Eliminar dura solo con confirmación múltiple.

### Auth
Actualizar login/session guard para impedir acceso de usuarios suspendidos o cancelados.

### Criterios De Aceptación
- Un usuario suspendido no puede usar el dashboard.
- Sus datos se conservan.
- La acción queda registrada en `AdminActionLog`.
- El admin puede reactivar usuarios suspendidos.

---

## Fase 5: Filtros Avanzados

### Objetivo
Permitir encontrar rápidamente usuarios que requieren atención.

### Filtros Sugeridos
- Plan: `FREE`, `PRO`.
- Estado: `ACTIVE`, `SUSPENDED`, `CANCELLED`.
- Sin propiedades.
- Con propiedades pero sin reservas.
- FREE cerca del límite de propiedades o clientes.
- Mercado Pago no conectado.
- Con pagos pendientes o vencidos.
- Creados entre fechas.

### Criterios De Aceptación
- La tabla permite combinar filtros.
- Los filtros son persistibles en query params.
- La paginación sigue funcionando correctamente.

---

## Fase 6: Indicadores De Salud Del Owner

### Objetivo
Mostrar rápidamente si un propietario está adoptando bien la plataforma o necesita soporte.

### Indicadores Sugeridos
- "Sin propiedades" (rojo).
- "Sin reservas" (amarillo).
- "MP desconectado" (amarillo).
- "Al límite FREE" (naranja).
- "Pagos vencidos" (rojo).
- "Activo" (verde).

### Criterios De Aceptación
- El admin identifica owners problemáticos desde la tabla.
- Los indicadores se calculan desde datos reales.

---

## Fase 7: Métricas De Conversión Y Crecimiento

### Objetivo
Entender monetización y adopción.

### Dashboard Admin
Agregar cards o secciones:
- Owners FREE.
- Owners PRO.
- Conversión FREE → PRO (porcentaje).
- Nuevos owners este mes.
- Crecimiento mensual.
- Owners activos vs inactivos.

### Estado Actual
`getDashboardStats` ya calcula: `growthPercentage`, `ownersThisMonth`, `ownersLastMonth`, `conversionPercentage`. Pero el dashboard usa `getSystemStats` que no tiene estos datos.

### Criterios De Aceptación
- Dashboard muestra conversión y crecimiento.
- Las métricas distinguen owners de otros roles.

---

## Fase 8: Onboarding Tracking

### Objetivo
Saber en qué paso se queda cada propietario.

### Pasos Sugeridos
- Cuenta creada.
- Primera propiedad.
- Primer cliente.
- Primera reserva.
- Primer pago.
- Primer pago completado.
- Mercado Pago conectado.

### Implementación
No crear tabla nueva inicialmente. Calcular desde datos existentes:
- `properties.count > 0`, `clients.count > 0`, `reservations.count > 0`, `payments.count > 0`, `completedPayments.count > 0`, `UserIntegration.isActive === true`.

### Criterios De Aceptación
- El detalle del owner muestra progreso de onboarding.
- El admin detecta usuarios "trabados".

---

## Fase 9: Acciones Operativas

### Objetivo
Reducir soporte manual externo.

### Acciones Sugeridas
- Cambiar plan.
- Suspender / Reactivar.
- Resetear contraseña.
- Copiar email.
- Ver como usuario (impersonation - postergar).
- Ver reservas del owner.

### Fuera De Alcance Inicial
- Impersonation.
- Permisos administrativos granulares.
- Automatizaciones de email complejas.

---

## Fase 10: Exportación

### Objetivo
Permitir análisis externo simple.

### Exportables
- Owners con métricas de uso.
- Owners por plan/estado.
- Owners con pagos pendientes/vencidos.

### Formato
- CSV inicialmente.

### Criterios De Aceptación
- El admin puede descargar un CSV desde `/admin/users`.
- El CSV respeta filtros aplicados.

---

## Correcciones Técnicas

### Corregir Filtro ENTERPRISE
El schema actual solo tiene `FREE` y `PRO`. Remover `ENTERPRISE` del filtro de UI.

### Evitar `Button render={<Link />}`
Según `CONTEXT.md`, enlaces con apariencia de botón deben usar `Link` + `buttonVariants(...)`.

### Separar Server Actions Y API
- Formularios simples: Server Actions.
- Fetch interactivo desde client components: endpoints API.
- Evitar duplicar comportamiento crítico.

### Logging Transaccional
Cuando una acción cambia datos y registra log, hacer ambas en una transacción.

---

## Orden Recomendado

### Sprint 1
- Corregir filtro `ENTERPRISE`.
- Crear detalle de propietario (`/admin/users/[id]`).
- Mostrar resumen completo del owner.
- Conectar notas internas.

### Sprint 2
- Conectar historial de acciones.
- Mejorar logging con before/after.
- Exponer historial en UI.

### Sprint 3
- Agregar `UserStatus`.
- Reemplazar eliminación por suspensión/cancelación.
- Bloquear acceso de usuarios suspendidos.
- Mantener eliminación dura como acción excepcional.

### Sprint 4
- Filtros avanzados.
- Indicadores de salud.
- Alertas "requieren atención".

### Sprint 5
- Métricas de conversión.
- Onboarding tracking.
- Exportación CSV.

---

## Riesgos

- Borrar usuarios permanentemente puede destruir auditoría financiera.
- Agregar demasiados filtros de golpe puede complicar queries y UI.
- Duplicar lógica entre Server Actions y API puede provocar inconsistencias.
- Suspensión requiere revisar auth, dashboard y APIs protegidas.
- Métricas financieras deben distinguir pagos `RESERVATION` vs `EXTRA`.

## Decisiones Pendientes

1. ¿El modal actual se mantiene como resumen rápido o se reemplaza por página dedicada?
2. ¿La eliminación dura se elimina de la UI o queda con confirmación especial?
3. ¿Se necesita tracking de última actividad/login ahora o después?
4. ¿El admin necesita enviar emails desde el sistema?
5. ¿Se mantendrán solo planes `FREE`/`PRO` o se planea agregar `ENTERPRISE`?
