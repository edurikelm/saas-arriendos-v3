# RentalPro - Sistema de Administración de Arriendos

Sistema SaaS para gestionar propiedades en arriendo, con reservas diarias o mensuales, calendario interactivo, cartera de clientes, reportes con exportación y pagos vía Mercado Pago.

## 🛠️ Stack Tecnológico

| Categoría | Tecnología |
|-----------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Lenguaje** | TypeScript |
| **Estilos** | Tailwind CSS 4 |
| **UI** | shadcn/ui + Radix UI |
| **Iconos** | Lucide React |
| **Formularios** | React Hook Form + Zod |
| **Calendario** | FullCalendar 6 |
| **Base de datos** | PostgreSQL + Prisma 7 |
| **Autenticación** | Supabase Auth |
| **Pagos** | Mercado Pago SDK |
| **Exportación** | xlsx + jsPDF |

## 🚀 Getting Started

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local

# Ejecutar migraciones
npx prisma migrate dev

# Iniciar servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

## 📁 Estructura del Proyecto

```
app/
├── (auth)/                 # Login y Registro
├── (dashboard)/            # Rutas protegidas
│   ├── dashboard/          # Panel principal
│   ├── properties/         # CRUD de propiedades
│   ├── reservations/       # Gestión de reservas
│   ├── calendar/           # Calendario interactivo
│   ├── clients/            # Cartera de clientes
│   ├── reports/            # Reportes y exportación
│   └── settings/           # Configuración y plan
├── api/                    # API routes (properties, clients)
└── generated/              # Prisma Client generado

components/
├── ui/                     # shadcn/ui components
├── layout/                 # Navbar, Sidebar, Shell
├── properties/             # PropertyCard, PropertyForm
├── reservations/           # ReservationModal
├── clients/                # ClientModal
├── calendar/               # Componentes de calendario
└── shared/                 # Empty states, skeletons, dialogs

lib/
├── actions/                # Server Actions (properties, reservations, clients, reports, mercadopago)
├── db/                     # Queries a base de datos
├── plan/                   # Lógica de planes y límites
├── supabase/               # Cliente, server y middleware
├── validations/            # Schemas Zod (auth, property)
├── constants.ts            # Constantes globales
└── export-utils.ts         # Exportación Excel/PDF

prisma/
├── schema.prisma           # Modelos de datos
├── seed.ts                 # Datos semilla
└── migrations/             # Migraciones
```

## 🗄️ Modelos de Datos

| Modelo | Descripción |
|--------|-------------|
| **UserProfile** | Perfil del usuario con plan (free/pro) y límites |
| **Property** | Propiedades con tipo, precios, amenidades, color e imágenes |
| **Reservation** | Reservas con huésped, fechas, pricing, estado y descuentos |
| **Payment** | Pagos asociados a reservas (efectivo, tarjeta, transferencia) |
| **ReservationClient** | Cartera de clientes con RUT, dirección y vinculación a reservas |
| **ReservationFile** | Archivos adjuntos a reservas |

## ✨ Funcionalidades

### Autenticación
- Login y registro con email/contraseña vía Supabase
- Middleware que protege rutas del dashboard
- Validación con Zod (contraseña con mayúscula, minúscula y número)

### Dashboard
- Saludo personalizado según hora del día
- Cards de resumen: propiedades, reservas totales, confirmadas y pendientes
- Barra de ocupación visual
- Listado de arriendos activos con barra de pago
- Próximas 5 reservas

### Propiedades
- CRUD completo con formulario de 4 tabs (Básico, Arriendo, Detalles, Imágenes)
- Tipos: casa, departamento, cabaña, hostel, hotel, oficina, comercial
- Arriendo diario, mensual o ambos con moneda configurable (USD, CLP, EUR, ARS)
- Vista en tabla con filtros o vista grid con tarjetas
- Color asignado por propiedad (visualización en calendario)

### Reservaciones
- Crear/editar desde modal con selección de propiedad y fechas
- Estados: pendiente, confirmado, cancelado, completado
- Precio total, monto pagado, descuento, flag de booking Airbnb
- Registro de pagos incrementales
- Creación automática de cliente al reservar con email
- Generación de link de pago Mercado Pago

### Calendario
- FullCalendar con vista mensual y locale español
- Eventos coloreados según color de propiedad
- Filtro por estado y toggle de visibilidad por propiedad
- Click en evento muestra detalle con acciones (ver, editar, eliminar, link de pago)
- Click en fecha vacía para crear nueva reserva

### Clientes
- Tabla con búsqueda por nombre, email, teléfono o RUT
- Modal de creación/edición con validación de email único
- Vinculación automática con reservas
- Contador de reservas por cliente

### Reportes
- Filtros por rango de fechas, propiedad y estado
- Quick ranges: mes actual, mes anterior, últimos 3/6 meses, todo
- Estadísticas: ingreso total, total pagado, saldo pendiente, precio promedio
- Resumen agrupado por propiedad
- Exportación a **Excel** (2 hojas: detalle + resumen) y **PDF** (tabla formateada)

### Configuración
- Visualización del plan actual con uso de propiedades y clientes
- Integración Mercado Pago: guardar Access Token con validación

## 💰 Sistema de Planes

| Característica | FREE | PRO |
|---------------|------|-----|
| Propiedades | Máx 3 | Ilimitadas |
| Clientes | Máx 5 | Ilimitados |
| Exportar Excel/PDF | ❌ | ✅ |
| Reportes avanzados | Solo mes actual | Sin restricción |
| Notificaciones email | ❌ | ✅ |

## 🔗 Rutas

| Ruta | Descripción |
|------|-------------|
| `/login` | Inicio de sesión |
| `/register` | Registro de usuario |
| `/dashboard` | Panel principal |
| `/properties` | Listado de propiedades |
| `/properties/new` | Crear propiedad |
| `/properties/[id]` | Detalle de propiedad |
| `/properties/[id]/edit` | Editar propiedad |
| `/reservations` | Listado de reservas |
| `/calendar` | Calendario interactivo |
| `/clients` | Cartera de clientes |
| `/reports` | Reportes y exportación |
| `/settings` | Configuración y plan |

### API Routes

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/properties` | GET | Listar propiedades del usuario |
| `/api/properties/[id]` | GET | Detalle de propiedad |
| `/api/properties/[id]/reservations` | GET | Reservas activas de una propiedad |
| `/api/clients` | GET | Listar clientes del usuario |

## 📦 Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run start    # Servidor de producción
npm run lint     # Linter
```

## 🚀 Deploy

Desplegar en [Vercel](https://vercel.com) configurando las variables de entorno de Supabase, la base de datos PostgreSQL y opcionalmente el Access Token de Mercado Pago.
