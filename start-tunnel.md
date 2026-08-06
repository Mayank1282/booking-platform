# Running Slotwise locally

Three processes. Each needs its **own terminal**, left running.

> `ngrok` and `stripe` were installed with winget. If a terminal says
> `command not found`, close it and open a **new** one so the PATH updates.

---

## 1. Backend API — port 8000

```
cd g:\Projects\booking-platform\booking-platform-backend
php artisan serve --port=8000
```

Stop with **Ctrl+C**.

## 2. Frontend — port 5173

```
cd g:\Projects\booking-platform\booking-platform-frontend
npm run dev
```

Stop with **Ctrl+C**. Opens at http://localhost:5173

## 3. ngrok tunnel — only needed when testing Stripe webhooks

```
ngrok http --url=elitism-numerate-drone.ngrok-free.dev 8000
```

Stop with **Ctrl+C**.

Public URL (static — never changes):
`https://elitism-numerate-drone.ngrok-free.dev`

Live request inspector while it runs: http://127.0.0.1:4040

---

## Force-stop anything left running

PowerShell:

```
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process php   -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process node  -ErrorAction SilentlyContinue | Stop-Process -Force
```

Check what is holding a port:

```
netstat -ano | findstr ":8000 :5173 :4040"
```

---

## Stripe webhook destinations

Two destinations exist, each with its **own** signing secret.

| Destination | Endpoint URL | Secret belongs in |
|---|---|---|
| Local (ngrok) | `https://elitism-numerate-drone.ngrok-free.dev/api/webhooks/stripe` | `booking-platform-backend/.env` |
| Production | `https://<render-url>/api/webhooks/stripe` | Render environment variables |

Only one is ever loaded at a time, so they never conflict. `.env` is gitignored,
so the local secret cannot leak into production.

After changing `STRIPE_WEBHOOK_SECRET`:

```
php artisan config:clear
```

A wrong or missing secret makes the webhook return **400** — that is deliberate,
since the signature is the only thing authenticating that public endpoint.

---

## Database

MySQL must be running (XAMPP / Laragon / Windows service).

```
php artisan migrate:fresh --seed    # rebuild + reseed demo data
```

Demo accounts — password `password` for all:

| Role | Email |
|---|---|
| Client | client@slotwise.test |
| Provider | provider@slotwise.test |
| Admin | admin@slotwise.test |
