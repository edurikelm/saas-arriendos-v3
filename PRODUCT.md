# RentalPro — Product

## What this is

A B2B SaaS that helps property owners (hosts/anfitriones) manage short-term and monthly rentals across multiple properties. The product centralizes reservations, payments, calendar occupancy, and guest communication in one dashboard.

## Who it's for

**Primary persona — OWNER (host)**: Small to mid-size property managers in Chile (LATAM). They run 1–20 properties, mix direct bookings with Airbnb/Booking.com, and need a single place to see what's coming up, who's paid, and what needs action. They speak Spanish.

**Secondary persona — SUPER_ADMIN (us)**: Internal team running the platform, providing support, and monitoring health across all owners.

## Core jobs the product does

1. **Track reservations** — owner can see what's booked, in which property, with which guest, for which dates, and at what status (PENDING → CONFIRMED → COMPLETED or CANCELLED).
2. **Collect payments** — link Mercado Pago checkout, register manual cash/transfer payments, attach receipts, separate rent from extras (cleaning, fines, etc.).
3. **Coordinate calendar** — see which nights are occupied across all properties, prevent double-booking, sync with external channels (Airbnb, Booking, VRBO) via iCal.
4. **Manage properties and guests** — CRUD for properties (with photos, amenities, daily/monthly rates) and guests (clients).
5. **Report on the business** — revenue, occupancy, collection status, period comparisons.
6. **Get help when stuck** — open a support ticket that a SUPER_ADMIN responds to.

## What the product deliberately does not do

- No guest-facing booking flow (owner handles booking off-platform or via external channels).
- No marketing/SEO pages for individual properties.
- No multi-currency (Chile-only, CLP).
- No mobile app (responsive web only).
- No public marketplace of properties.

## Plans

- **FREE** — 3 properties max, 5 clients max, limited reports.
- **PRO** — unlimited properties, unlimited clients, full reports, iCal sync.

## Voice and tone

Written for an operator who manages the business daily, not a tourist booking a stay. Direct, factual, status-oriented. Spanish throughout. Numbers shown as CLP ($1.234.567), dates in es-CL format (15 ago 2026).

## Brand personality

- **Trustworthy** — money is on the line, the product must feel reliable and precise.
- **Operational** — the user opens this app to act, not to be entertained.
- **Calm** — no marketing copy, no celebratory microcopy, no urgency theatre.

## Surface map

- `/dashboard` — owner home (KPIs + upcoming reservations + recent activity)
- `/calendar` — timeline/grid of reservations across properties
- `/reservations` — list of all reservations
- `/reservations/[id]` — detail (info, payments, documents for monthly, history)
- `/reservations/new` — create a new reservation
- `/clients` — list of guests
- `/properties` — list of properties
- `/properties/[id]` — property detail
- `/payments` — payment tracking
- `/reports` — financial reports
- `/settings` — profile, company, integrations
- `/support` — support tickets (owner-facing)
- `/admin/*` — super admin console
