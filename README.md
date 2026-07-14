# MPC Drop

A limited product drop: shoppers reserve a unit, hold it for 15 minutes, and check out before the
reservation expires. The interesting problem is not the CRUD — it is making sure that when 50 people
race for the last 5 units, exactly 5 of them win.

**Live:** _(hosted link)_

- **Backend** — NestJS, TypeScript, PostgreSQL, TypeORM
- **Frontend** — React, TypeScript, Vite, TanStack Query
- **Node** — 24 (see `.nvmrc`)

---

## Running it locally

```bash
docker compose up -d              # PostgreSQL on :5432

cd backend
cp .env.example .env              # DB_* must match docker-compose: postgres / postgres
pnpm install
pnpm migration:run
pnpm seed                         # 4 products, one deliberately scarce (5 units)
pnpm start:dev                    # http://localhost:3000

cd ../frontend
pnpm install
pnpm dev                          # http://localhost:5173
```

## Proving it does not oversell

```bash
cd backend
pnpm test:e2e                     # 7 e2e specs, including 50 buyers racing for 5 units
pnpm hammer 100                   # fires 100 concurrent reservations at the scarcest product
```

`pnpm hammer` prints what actually happened:

```
100 buyers racing for 5 units of "Solstice Field Jacket"

reserved:  5
sold out:  95
stock now: 0

✅ no oversell
```

> The e2e suite truncates the database and leaves its own fixture behind. Re-run `pnpm seed`
> afterwards to get the demo catalogue back.

---

## How overselling is prevented

Every reservation decrements stock with **one conditional UPDATE**, inside a transaction:

```sql
UPDATE products
   SET "availableQuantity" = "availableQuantity" - 1
 WHERE id = $1 AND "availableQuantity" > 0
```

Postgres takes a row lock for the duration of each `UPDATE`, so concurrent transactions touching the
same product are serialized by the database. Each one re-evaluates `availableQuantity > 0` against
the value the previous writer committed. When stock hits zero the `WHERE` clause stops matching,
`affected` comes back as `0`, and that caller is told the product is sold out. The reservation row is
only written after the decrement succeeds, so stock and reservations can never disagree.

What this deliberately avoids:

- **Read-then-write** (`SELECT` the quantity, decide in JavaScript, `UPDATE`). This is the bug the
  whole task is about: every concurrent request reads the same `5` and every one of them writes `4`.
  I verified this is not a hypothetical — swapping the atomic update for the naive version makes
  `test:e2e` sell **35 units out of 5**.
- **`SELECT ... FOR UPDATE`**, which would work, but takes an explicit lock and a second round trip
  to do what a single conditional `UPDATE` already does.
- **Optimistic retry loops**, which add machinery and, under a hot drop, mostly generate retries.

There is also a `CHECK ("availableQuantity" >= 0 AND "availableQuantity" <= "totalQuantity")`
constraint on `products`. It is a backstop, not the mechanism: notably it does *not* catch the naive
read-then-write bug above (each writer stores `4`, which is perfectly valid), but it does guarantee
that no future code path — a new endpoint, an admin script, a careless migration — can push stock
negative.

## How expiry works

Two independent layers, because a reservation that has expired must never convert into a sale:

1. **A sweep** (`@Cron`, every 30s) flips expired `active` reservations to `expired` and returns
   their units to stock. It is a single `UPDATE ... RETURNING "productId"`, so the sweep is itself
   race-safe.
2. **The checkout query itself** carries `AND "expiresAt" > NOW()`. Even if the sweep is late, dead,
   or the app has been redeployed, an expired reservation cannot be checked out. The database
   decides, not the clock on the client.

The same reasoning covers cancel-vs-expire: both paths are conditional updates guarded by
`status = 'active'`, so whichever transaction gets the row lock first wins and the other sees
`affected = 0`. A unit is returned to stock exactly once — there is an e2e test for precisely this.

## Why PostgreSQL

The correctness of this whole feature rests on one guarantee: a conditional `UPDATE` on a single row
must be atomic under concurrency. A relational database gives me that as a primitive, plus real
transactions to bind the decrement and the reservation insert together, plus a `CHECK` constraint as
a safety net. Reaching for a document store here would mean either finding an equivalent atomic
operator or rebuilding transactional semantics by hand — more work for a weaker guarantee.

---

## API

| Method | Path                        | Body                | Notes                                          |
| ------ | --------------------------- | ------------------- | ---------------------------------------------- |
| GET    | `/products`                 | —                   | Catalogue with live stock                      |
| GET    | `/products/:id`             | —                   | 404 if unknown                                 |
| POST   | `/reservations`             | `{ productId }`     | 201, or 409 `Product is sold out`              |
| GET    | `/reservations/:id`         | —                   | Lets the UI restore a reservation after reload |
| POST   | `/reservations/:id/checkout`| —                   | 409 if expired, cancelled or already completed |
| DELETE | `/reservations/:id`         | —                   | Releases the hold, returns the unit to stock   |

A reservation moves through `active → completed | expired | cancelled`, and never back.

---

## Deployment

Backend and database on Render (`render.yaml`), frontend on Vercel (`frontend/vercel.json`).

**Render** — New → Blueprint → pick this repo. It reads `render.yaml` and creates the Postgres
instance plus the API. `DATABASE_URL` is wired automatically; set `FRONTEND_URL` to the Vercel origin
once you have it, so CORS is pinned to it. On boot the service runs migrations and then a seed that
only fills an *empty* catalogue — free instances spin down when idle, and a cold start must not wipe
a shopper's reservation.

**Vercel** — import the repo, set **Root Directory** to `frontend`, and add
`VITE_API_URL=https://<your-api>.onrender.com`. The rewrite in `vercel.json` sends every path to
`index.html`, without which a direct hit on `/products/:id` would 404.

### Environment variables

| Variable       | Where    | Purpose                                                            |
| -------------- | -------- | ------------------------------------------------------------------ |
| `DATABASE_URL` | backend  | Managed Postgres connection string. Takes precedence over `DB_*`   |
| `DATABASE_SSL` | backend  | `false` to disable TLS (only for a `DATABASE_URL` pointing locally) |
| `DB_*`         | backend  | Local docker-compose credentials (`postgres` / `postgres`)          |
| `FRONTEND_URL` | backend  | Origin allowed by CORS. Unset means any origin                      |
| `VITE_API_URL` | frontend | Base URL of the API. Defaults to `http://localhost:3000`            |

> The first cold start on Render's free tier takes ~30 seconds while the instance wakes up.

---

## Assumptions

- **One reservation holds exactly one unit.** No quantity picker. Adding one is a `quantity` column
  and `- :quantity` in the same conditional update — the concurrency story does not change.
- **No authentication.** A reservation belongs to whoever created it, and the browser remembers its
  id in `localStorage` so a page reload does not silently drop a held unit. Anyone who knows a
  reservation id can check it out; real auth is the fix, and it is out of scope here.
- **A single backend instance.** See below.

## Trade-offs, and what I would do next

- **The expiry cron does not scale past one instance.** Run two replicas and both will sweep. It
  stays correct — the conditional update means only one transaction can expire a given reservation —
  but it is wasted work, and it is luck rather than design. With more time: a Postgres advisory lock
  around the sweep, or move expiry to a job queue with a single consumer.
- **Expiry is only as punctual as the cron.** A unit can sit unavailable for up to 30 seconds after
  its reservation lapses. Checkout is still correct throughout (layer 2 above); it is stock display
  that lags. Shortening the interval trades database load for freshness.
- **Tests share the development database.** `test:e2e` truncates it. A separate test database (or a
  throwaway container per run) is the right answer; I optimised for a small, readable setup.
- **No rate limiting.** `pnpm hammer 100` is a load test, but it is also exactly what an abusive
  client looks like. A per-IP throttle on `POST /reservations` would be the first thing I add before
  this saw real traffic.
- **No pagination on `/products`.** Fine for a drop of four items, wrong for a catalogue.
- **Stock in the UI is polled every 5 seconds.** Simple and good enough to watch stock melt during a
  drop. Server-sent events or websockets would make it instant.
