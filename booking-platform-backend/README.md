# Slotwise API

Laravel 13 REST API for the Slotwise booking marketplace. See the [project README](../README.md)
for the full picture; this file covers the backend specifically.

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan storage:link
php artisan serve
```

## Layout

```
app/
├── Enums/          BookingStatus, PaymentStatus, UserRole, LocationType
│                   (BookingStatus owns the legal state transitions)
├── Services/       The domain layer — controllers stay thin
│   ├── AvailabilityService   slot generation and the bookable-slot check
│   ├── BookingService        create / confirm / complete / cancel + emails
│   ├── PaymentService        Stripe intents, webhooks, refunds, simulated fallback
│   └── ReviewService         review creation + denormalised rating aggregates
├── Http/
│   ├── Controllers/Api/      one controller per resource
│   ├── Requests/             validation, isolated from controllers
│   ├── Resources/            response shaping
│   └── Middleware/           EnsureUserHasRole (`role:provider`, `role:client`)
├── Mail/           Markdown mailables for placed / confirmed / cancelled
├── Traits/         ApiResponse — the { success, message, data } envelope
└── Exceptions/     BookingException, rendering as a clean 422
```

## Things worth knowing

**Double-booking is prevented at the database, not the UI.** `BookingService::create` re-runs the
availability check inside a transaction with the provider's overlapping rows locked, so a stale
slot list cannot produce a conflicting booking.

**Prices are snapshotted.** `bookings.price_amount` is copied at booking time; later edits to a
service never rewrite what a client agreed to pay.

**Webhooks are idempotent.** Stripe delivers at-least-once. Every event id is written to
`webhook_events` and a replay is recognised and skipped.

**Mail never breaks a booking.** Sends are wrapped and logged on failure — an SMTP outage should
not roll back a paid appointment.

**Buffers are private.** A service's buffer extends the block a booking occupies in the calendar,
but not the end time the client sees.

## Environment

| Key | Purpose |
|---|---|
| `DB_CONNECTION` | `sqlite` locally, `mysql` in production |
| `FRONTEND_URL` | Drives CORS and the links in outgoing email |
| `STRIPE_SECRET` | Absent → simulated gateway; present → real PaymentIntents |
| `STRIPE_WEBHOOK_SECRET` | Required for webhook signature verification |
| `MAIL_*` | Brevo SMTP relay |

## Config

`config/booking.php` holds the scheduling rules — slot interval (15 min), booking horizon
(60 days), minimum notice (60 min) and the free-cancellation window (24 h).
