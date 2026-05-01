# Super Admin Panel — PRD

## Problem Statement

El panel de Super Admin actual es limitado. No proporciona visibilidad adecuada sobre la salud de la plataforma, las herramientas de gestión de usuarios son básicas, y falta capacidad de soporte (notas internas, historial de acciones) para asistir a los propietarios.

## Solution

Un centro de control unificado para el Super Admin que combina:
- **Supervisión y Analítica** — métricas de plataforma, crecimiento, ingresos
- **Gestión de Usuarios** — CRUD completo de propietarios
- **Herramienta de Soporte** — detalle de propietarios, notas internas, historial de acciones

## User Stories

1. Como Super Admin, quiero ver métricas generales (total usuarios, propiedades, reservas, ingresos) en un dashboard para entender la salud de la plataforma.
2. Como Super Admin, quiero ver el crecimiento de propietarios registrados por período para rastrear la adopción.
3. Como Super Admin, quiero ver los top propietarios por número de reservas o ingresos para identificar clientes clave.
4. Como Super Admin, quiero ver la tasa de conversión FREE→PRO para entender la monetización.
5. Como Super Admin, quiero ver una lista paginada de propietarios con filtros por plan y búsqueda por email/nombre para encontrarlos rápidamente.
6. Como Super Admin, quiero crear nuevos propietarios con email, contraseña, nombre y plan inicial.
7. Como Super Admin, quiero editar el nombre, email y plan de un propietario.
8. Como Super Admin, quiero eliminar un propietario y todos sus datos asociados.
9. Como Super Admin, quiero ver el detalle completo de un propietario: datos, propiedades, clientes, reservas.
10. Como Super Admin, quiero ver el historial de cambios en las reservas de un propietario para auditoría.
11. Como Super Admin, quiero agregar notas internas sobre un propietario para rastrear conversaciones de soporte.
12. Como Super Admin, quiero ver un registro de las acciones que otros admins realizaron (cambios de plan, eliminaciones) para auditoría.
13. Como Super Admin, quiero que el navbar muestre "Panel de Super Admin" con badge distintivo para saber dónde estoy.
14. Como Super Admin, quiero que el sidebar sea diferente o adapté al rol para ver solo las opciones relevantes.

## Implementation Decisions

### Schema Changes (Prisma)

**Nuevos modelos:**
- `AdminNote` — notas internas del admin sobre un propietario (adminId, ownerId, content, createdAt, updatedAt)
- `AdminActionLog` — log de acciones del admin (adminId, targetId, action, details, createdAt)

**Relaciones en UserProfile:**
- `adminNotes` — notas escritas por este admin
- `ownerNotes` — notas sobre este usuario
- `adminActions` — acciones realizadas por este admin

### API Endpoints

- `GET /api/admin/stats` — métricas generales de plataforma
- `GET /api/admin/users` — lista paginada con filtros (page, limit, search, plan)
- `POST /api/admin/users` — crear propietario
- `PATCH /api/admin/users` — editar propietario + logging de acción
- `DELETE /api/admin/users?userId=X` — eliminar propietario
- `GET /api/admin/users?userId=X` — detalle de un propietario (con propiedades, clientes, reservas, notes)
- `GET /api/admin/notes?ownerId=X` — obtener notas de un propietario
- `POST /api/admin/notes` — crear nota
- `DELETE /api/admin/notes?noteId=X` — eliminar nota
- `GET /api/admin/action-logs?targetId=X` — historial de acciones sobre un target

### Frontend Components

- **Navbar adaptado por rol** — muestra "Panel de Super Admin" + badge Shield para SUPER_ADMIN
- **Sidebar simple para admin** — links: Dashboard, Usuarios (placeholders para Reportes, Config después)
- **Dashboard admin mejorado** — cards de métricas, top owners, recent owners, quick actions
- **Users admin page** — tabla con filtros, diálogo de detalle con tabs (info, propiedades, historial, notas)
- **Notas internas UI** — componente de notas con CRUD en el diálogo de detalle del usuario

### Action Logging

Cuando se realiza una acción de admin via API (cambio de plan, creación, eliminación), se inserta un registro en `AdminActionLog` de forma automática o manual en cada handler.

### Sidebar Structure

```
Sidebar Admin:
├── Dashboard  → /admin
├── Usuarios   → /admin/users
├── Reportes   → placeholder (para después)
└── Config     → placeholder (para después)
```

## Testing Decisions

- **Test de API**: endpoints de admin retornan 401 si no es SUPER_ADMIN
- **Test de UI**: el diálogo de detalle de usuario muestra todas las secciones (info, propiedades, notas)
- **Test de logging**: verificar que al cambiar plan se inserta un AdminActionLog

## Out of Scope

- Impersonate (ver la plataforma como si fuera otro usuario)
- Reportes avanzados con gráficos complejos
- Multi-tenancy con permisos granulares (por ahora solo SUPER_ADMIN)
- Migración de datos de un propietario a otro

## Further Notes

- El schema ya tiene `name` como opcional en UserProfile
- El navbar obtiene session del endpoint `/api/auth/session`
- Los placeholders de Reportes y Config pueden implementarse después sin estructural adicional
