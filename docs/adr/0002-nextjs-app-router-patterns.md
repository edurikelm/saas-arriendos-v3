# ADR-0002: Next.js App Router - Patrones de Componentes y Layouts

## Status

Aprobado

## Context

Durante una auditoría de best practices de Next.js, se identificaron varios patrones que necesitaban formalizarse para mantener consistencia en el codebase y seguir las convenciones de Next.js 16 App Router.

## Decision

### 1. Server Components como default

Los layouts y páginas son Server Components por defecto. `'use client'` solo se usa cuando es necesario:
- Interactividad (useState, useEffect, event handlers)
- hooks de Next.js (useRouter, usePathname, useSearchParams)
- Librerías de UI que requieren client-side rendering

### 2. Extracción de lógica interactiva a componentes separados

Cuando un layout tiene both server data fetching AND interactive state, se extrae la parte interactiva a un componente `*LayoutClient`.

**Ejemplo:**
```tsx
// layout.tsx (Server Component)
import { getSession } from "@/lib/actions/auth";
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";

export default async function DashboardLayout({ children }) {
  const session = await getSession();
  return (
    <DashboardLayoutClient
      children={children}
      userName={session?.email?.split("@")[0] ?? null}
      userRole={session?.role ?? null}
    />
  );
}

// *LayoutClient.tsx (Client Component)
"use client";
export function DashboardLayoutClient({ children, userName, userRole }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // ...
}
```

### 3. Error Handling obligatorio

Cada route group debe tener:
- `error.tsx` — Error boundary para el segmento
- `not-found.tsx` — Página 404 personalizada

```tsx
// error.tsx
"use client";
export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}

// not-found.tsx
export default function NotFound() {
  return <h2>Page not found</h2>;
}
```

### 4. Metadata en layouts

Todos los layouts deben exportar `metadata` para SEO:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - RentalPro",
  description: "...",
};
```

### 5. Middleware naming (Next.js 16+)

Usar `proxy.ts` en lugar de `middleware.ts` con exports `proxy` y `config`:

```tsx
// src/proxy.ts
export async function proxy(request: NextRequest) { ... }
export const config = { matcher: ["/dashboard/:path*"] };
```

### 6. Route Guards por Rol (dos capas)

Los guards de ruta se organizan en dos capas que no deben mezclarse:

**Capa 1 — `proxy.ts` (auth-only):**
- Valida el JWT de la cookie y redirige a `/login` si es inválido o no existe.
- **NO decide por rol**. El rol del JWT puede estar desactualizado si se cambió en DB con la cookie viva.
- Matcher cubre rutas owner y `/admin`.

**Capa 2 — Layouts con guards server-side:**
- `requireOwner()` — redirect SUPER_ADMIN a `/admin`
- `requireSuperAdmin()` — redirect no-SUPER_ADMIN a `/dashboard`
- Ambas llaman primero a `requireAuth()` (redirige a `/login` si no hay sesión), luego verifican el rol contra `getSession()` que consulta la DB.

**Cadena completa:**
```
proxy.ts (JWT auth gate, role-agnostic)
  → layout.tsx server (requireOwner / requireSuperAdmin via DB)
    → children (page content)
```

**Helper compartido `src/lib/auth/role-routes.ts`:**
```ts
export function getDefaultPathForRole(role: string | null | undefined): string {
  if (role === "SUPER_ADMIN") return "/admin";
  return "/dashboard";
}
```

Centralizado en `page.tsx` (root redirect) y `login-form.tsx` (post-login redirect).

## Implementation

### Archivos creados/cambiados

**Error boundaries:**
- `src/app/(dashboard)/error.tsx`
- `src/app/(dashboard)/not-found.tsx`
- `src/app/(auth)/error.tsx`
- `src/app/(auth)/not-found.tsx`
- `src/app/admin/error.tsx`
- `src/app/admin/not-found.tsx`
- `src/app/global-error.tsx`

**Layout conversions (use client → server):**
- `src/app/(dashboard)/layout.tsx` — Server Component con `requireOwner()`
- `src/app/admin/layout.tsx` — Server Component con `requireSuperAdmin()`

**Client components extracted:**
- `src/components/layout/dashboard-layout-client.tsx`
- `src/components/layout/admin-layout-client.tsx`

**Route guards (2026-06-05):**
- `src/lib/actions/auth.ts` — `requireOwner()` añadido
- `src/lib/auth/role-routes.ts` — helper `getDefaultPathForRole()` y `isSuperAdmin()`
- `src/proxy.ts` — gate de auth sin decisión de rol, matcher cubre `/admin/*`
- `src/__tests__/proxy.test.ts` — tests del gate de auth
- `src/lib/auth/__tests__/role-routes.test.ts` — tests del helper
- `src/lib/actions/__tests__/auth.test.ts` — tests de `requireOwner()`

## Consequences

### Positivo

- Server Components reducen client bundle size
- Session se obtiene en el servidor, sin useEffect overhead
- Error handling consistente en toda la app
- SEO mejorado con metadata en todos los layouts
- Proxy no decide por rol — fuente autoritativa es DB, evitando loops por JWT desactualizado

### Negativo

- Mayor número de archivos para mantener
- Patrón `*LayoutClient` puede parecer verbose initially

## References

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Next.js 16 Proxy Naming](https://nextjs.org/docs/app/api-reference/file-conventions)
- Skill: `.agents/skills/next-best-practices/`