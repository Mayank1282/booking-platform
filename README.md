# Slotwise — Booking & Payment Platform

Portfolio project #3. A two-sided service marketplace where providers list what they do, publish
real working hours, and take bookings; and clients browse, pick a genuinely free slot, pay, and
review afterwards.

Built as a **decoupled SPA**: a Laravel REST API and a React 19 front end, deployed separately.

```
booking-platform/
├── booking-platform-backend/    Laravel 13 API (Sanctum, Stripe, MySQL/SQLite)
└── booking-platform-frontend/   React 19 + Vite + Tailwind v4 SPA
```

---

## What it does

**Clients**
- Browse and filter the directory by category, price, rating, city and location type
- Explore providers on a Leaflet + OpenStreetMap map
- See real availability generated from the provider's rules, minus bookings, buffers and blocked dates
- Book a slot, pay, and get a confirmation email
- Cancel free up to 24 hours before (payment auto-refunded), and review after completion

**Providers**
- Create and manage services — duration, buffer, price, category, location type, image
- Set weekly working hours and block out one-off dates
- Confirm, complete and cancel bookings
- Track earnings, monthly revenue and reviews on a bento-grid dashboard

**Admins**
- Platform overview: GMV, signups, listings, bookings by status, revenue and signup trends
- User management: search and filter by role or status, **suspend** (reversible) or **erase**
- Moderation: unpublish or restore any listing
- Full visibility of every booking and every payment on the platform

> **Suspend vs erase.** Suspending blocks access immediately — all tokens are revoked and sign-in
> is refused — but nothing is lost and it can be undone. Erasing is permanent: it scrubs every
> personal field and **releases the email address for re-registration**.
>
> Erase anonymises rather than hard-deletes, deliberately. A booking is a financial record shared
> by two people; dropping the user row would cascade away the counterparty's history and the
> payment ledger with it. So the row survives with the personal data removed, upcoming bookings
> are cancelled, settled payments refunded, and the original email is freed.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Laravel 13, PHP 8.5 |
| Auth | Laravel Sanctum (bearer tokens) |
| Database | MySQL in production · SQLite locally (see note below) |
| Payments | Stripe PaymentIntents + signed webhooks, with a simulated fallback |
| Maps | Leaflet + OpenStreetMap tiles, Nominatim geocoding — no key, no billing |
| Mail | Brevo SMTP relay, Markdown mailables |
| Frontend | React 19, Vite 8, Tailwind CSS v4, React Router v7 |
| Charts | Recharts | 
| Icons | Lucide React |

---

## Design identity — "Warm Editorial Marketplace"

Each project in this portfolio gets its **own** visual language; only the responsive behaviour is
shared. Projects 1 and 2 are cool indigo SaaS dashboards. This one deliberately is not.

- **Palette:** warm paper and espresso, terracotta accent, sage and gold support. No blue anywhere.
- **Type:** Fraunces (editorial serif) for display · Inter for UI · JetBrains Mono for every number,
  time and booking reference.
- **Shape:** hairline borders instead of drop shadows; large soft surfaces holding sharp inner
  elements; bento-grid dashboards rather than uniform card walls.
- **Dark mode:** warm espresso, never blue-black. Applied before first paint, so there is no flash.

**Mobile is the constant.** The responsive contract matches the other portfolio projects exactly:
hamburger drawer nav, 44px minimum touch targets, tables collapsing to cards, bento collapsing to
one column, and no horizontal page scroll anywhere. Only the skin differs.

---

## Running it locally

### Backend

```bash
cd booking-platform-backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan storage:link
php artisan serve            # http://localhost:8000
```

### Frontend

```bash
cd booking-platform-frontend
npm install
cp .env.example .env         # VITE_API_URL=http://localhost:8000
npm run dev                  # http://localhost:5173
```

### Demo accounts

Password for all of them: `password`

| Role | Email |
|---|---|
| Client | `client@yopmail.com` |
| Provider | `provider@yopmail.com` |
| **Admin** | `admin@yopmail.com` |

There is no separate admin URL — sign in as the admin and `/app` becomes the admin console
(`/app/admin/users`, `/app/admin/services`, `/app/admin/bookings`, `/app/admin/payments`).

Five more clients and five more providers are seeded — see `database/seeders/DemoSeeder.php`.
The seed spreads bookings across the last five months and the next three weeks, in every status,
so the dashboards, charts, history lists and review flows all have real data behind them.

---

## Notes on two decisions

**SQLite locally, MySQL in production.** No MySQL server is installed on the development machine,
so `DB_CONNECTION=sqlite` is the local default. Every migration and query is written to run
unchanged on both — date grouping is done in PHP rather than with driver-specific SQL functions,
and `lockForUpdate()` is a no-op on SQLite but a real row lock on MySQL. To use MySQL, set
`DB_CONNECTION=mysql` and fill the credentials in `.env`.

**Stripe optional.** With `STRIPE_SECRET` set, the app creates real PaymentIntents and confirms
bookings from the signed webhook (replay-safe: every event id is recorded before it is handled).
With the key absent it falls back to a simulated gateway, so the entire
booking → payment → confirmation → refund lifecycle is demonstrable with no keys and no billing
account. The payment row, the booking transition and the emails are real either way.

**Maps without a card.** Leaflet with OpenStreetMap tiles and Nominatim geocoding — no API key, no
billing account, no quota. Chosen over Google Maps specifically because this app goes live and
Google Maps requires a card on file.

---

## API shape

Every endpoint answers with the same envelope:

```json
{ "success": true, "message": "OK", "data": {}, "meta": {} }
```

`meta` appears on paginated responses. Validation failures return `422` with an `errors` object
keyed by field name.

<details>
<summary>Endpoint list</summary>

**Public**
```
POST   /api/auth/register            POST   /api/auth/login
POST   /api/auth/forgot-password     POST   /api/auth/reset-password
GET    /api/categories
GET    /api/services                 GET    /api/services/{slug}
GET    /api/services/{slug}/reviews
GET    /api/services/{slug}/availability?date=YYYY-MM-DD
GET    /api/services/{slug}/availability/month?year=&month=
POST   /api/webhooks/stripe          (authenticated by Stripe signature)
```

**Authenticated**
```
GET    /api/auth/me                  POST   /api/auth/logout
POST   /api/auth/profile             POST   /api/auth/password
GET    /api/dashboard                GET    /api/payments
GET    /api/bookings                 GET    /api/bookings/{id}
POST   /api/bookings/{id}/cancel
```

**Client only**
```
POST   /api/bookings
POST   /api/bookings/{id}/pay        GET  /api/bookings/{id}/pay/status
POST   /api/bookings/{id}/pay/simulate
POST   /api/bookings/{id}/review
```

**Admin only**
```
GET     /api/admin/overview
GET     /api/admin/users
POST    /api/admin/users/{user}/suspend      POST /api/admin/users/{user}/reinstate
DELETE  /api/admin/users/{user}              (erase + release email)
GET     /api/admin/services                  POST /api/admin/services/{slug}/toggle
GET     /api/admin/bookings                  GET  /api/admin/payments
```

**Provider only**
```
GET/POST      /api/provider/services
POST/DELETE   /api/provider/services/{slug}
GET/PUT       /api/provider/availability/rules
GET/POST      /api/provider/availability/blocks
DELETE        /api/provider/availability/blocks/{id}
POST          /api/provider/bookings/{id}/confirm
POST          /api/provider/bookings/{id}/complete
GET           /api/provider/reviews
```
</details>

---

## How availability actually works

This is the core of the app, in `app/Services/AvailabilityService.php`.

For a given service and date it takes the provider's weekly rules for that weekday, walks each
window on a 15-minute grid, and rejects any candidate slot that:

- starts less than the minimum notice window from now,
- would run past the end of the working window (duration **plus** the provider's private buffer),
- overlaps a one-off blocked range, or
- overlaps an existing pending/confirmed booking, extended by that booking's buffer.

The list a client sees can go stale between page load and pressing confirm, so `BookingService`
re-runs the same check **inside** a database transaction with the provider's conflicting rows
locked. Two clients racing for the last slot cannot both win — the loser gets a clean 422 rather
than a double booking.

---

## Deployment

- **Frontend → Vercel.** Set `VITE_API_URL` to the deployed API origin.
- **Backend → Render.** Set the app key, database credentials, mail and (optionally) Stripe keys.
  Point `FRONTEND_URL` at the Vercel domain — it drives both CORS and the links in outgoing email.
- **Database → MySQL** (TiDB Cloud or PlanetScale free tier).
- **Stripe webhook →** `https://your-api/api/webhooks/stripe`, subscribed to
  `payment_intent.succeeded`, `payment_intent.payment_failed` and `charge.refunded`.
