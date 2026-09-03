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

### Downgrade: what happens to resources over the limit

**Nothing is taken away. The limit blocks creation, never operation.**

An owner who drops from PRO to FREE with 7 properties keeps all 7: they stay
visible, editable, and fully operational — reservations, calendar, payments and
collections included. What they cannot do is create the 8th. The only automatic
side effect is the soft-stop of iCal resources, which are a PRO feature
(external calendars and channel blocks go inactive; see #220).

**Why not lock or hide the excess**, which is what comparable products do:

- Figma locks editing until you move files out and get within the limit.
- Hospitable — vacation rental software, same vertical — auto-mutes properties
  beyond the plan limit; muting stops calendar sync, messaging and pricing sync.

Both can do that because **the obligation lives elsewhere**: a Figma file has no
guest, and Hospitable's bookings live on Airbnb or Booking, so muting stops
their software's activity, not the host's business.

RentalPro is the system of record. The reservation, the client and the payments
live here. Locking a property whose guest arrives tomorrow does not remove an
integration — it removes the operation: the owner could not see who is checking
in, or register the payment of someone already staying. **A billing limit must
never stand between an owner and a guest who is physically in the property.**

**The UI must say this plainly.** Over the limit, the banner states the real
numbers ("Tu plan FREE permite 3 propiedades y tienes 7") and that what already
exists keeps working. Saying "cerca del límite" to someone four above it is
false, and a product whose first brand value is *Trustworthy* cannot afford
false statements about the plan the customer pays for.

**If enforcement is ever needed**, the safe equivalent of muting here is
archiving only the *inert* excess: properties with no future reservations and no
pending payments. Those carry no live obligation, so archiving them breaks
nothing — and they are typically the excess of an owner who downgraded because
they stopped using them. With a grace period and advance notice, per standard
practice. Not implemented; deliberately deferred.

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
