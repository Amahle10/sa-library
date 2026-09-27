# SA Library — local V1

A digital discovery, reservation and circulation platform for South African public libraries, allowing users to search physical books, see branch availability, reserve copies, collect books physically and manage active loans.

This is a working local MVP with **fictional demo inventory**. Branch names and general Gauteng location text are illustrative; this application is not connected to a municipality and does not represent live stock, verified opening hours, or real membership records.

## Architecture and stack

```text
apps/web/          React + TypeScript + Vite + React Router + Tailwind
apps/api/          Express + TypeScript + Prisma 7 + PostgreSQL
packages/shared/   Shared role, copy-status and reservation-status enums
scripts/           Local database startup and Docker database initialization
e2e/              Playwright browser journeys
```

The API separates route validation, authentication/role middleware, services and database access. Zod validates requests; bcrypt hashes passwords; JWTs contain only the subject and standard token claims. `/auth/me` and authenticated requests load the current database account. Password hashes are never returned. Helmet and a configured CORS origin protect the API boundary.

The frontend uses one API client, React Context for authentication and role-protected routes. The eight-hour access token is stored in `sessionStorage`, survives reloads in the same tab and is removed on logout. Logout does not revoke an already-issued token server-side in V1. No Redux, payments, subscriptions or South African ID-number storage is included.

## Requirements

- Node.js 22.12+; Node.js 24 LTS recommended.
- pnpm 11.25.0 (pinned in `packageManager`).
- PostgreSQL; the supplied Docker setup uses PostgreSQL 18.
- For browser tests: Playwright Chromium or an installed Google Chrome executable.

## Setup

From the parent `public_service` directory:

```bash
cd sa-library
pnpm install
```

Choose **one** database option below.

### Option A: Docker

```bash
docker compose up -d --wait
cp apps/api/.env.example apps/api/.env
```

The development-only database credentials in `compose.yaml` are `sa_library` / `local-library-only`. PostgreSQL listens on `127.0.0.1:5432`; the initialization script creates `sa_library_test` alongside `sa_library`. If the Docker volume already existed before the test database was configured, create it with:

```bash
docker compose exec postgres createdb -U sa_library sa_library_test
```

### Option B: Ubuntu local binaries, without Docker or sudo

This fallback is provided for environments like the current workspace, where Docker socket access is unavailable. It requires Ubuntu repositories containing `postgresql-18`, `apt-get`, `dpkg-deb`, and compatible runtime libraries.

```bash
pnpm db:local
```

It downloads and extracts PostgreSQL into ignored `.local/postgres`, creates both databases and starts on `127.0.0.1:55432`. It installs no system packages. This development-only cluster uses trust authentication on loopback; do not expose it on a public interface or use it in production.

Set these URLs in `apps/api/.env`:

```env
DATABASE_URL="postgresql://sa_library@127.0.0.1:55432/sa_library"
TEST_DATABASE_URL="postgresql://sa_library@127.0.0.1:55432/sa_library_test"
```

Stop this instance with `pnpm db:local:stop`. Its data persists under `.local/postgres`; running `pnpm db:local` starts it again. The current workspace's ignored API `.env` is already configured for this option.

### Option C: Existing PostgreSQL

Create separate `sa_library` and `sa_library_test` databases owned by your development database user, then set both connection URLs. The test user must be able to create and drop schemas in the test database. Never point `TEST_DATABASE_URL` at a real application database.

### Environment variables

Copy `apps/api/.env.example` if you have not already created `.env`. Generate a secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the result into `JWT_SECRET`. Keep `.env` files private; they are ignored by Git.

| Variable                 | Purpose / default                                                           |
| ------------------------ | --------------------------------------------------------------------------- |
| `DATABASE_URL`           | Required PostgreSQL connection URL                                          |
| `TEST_DATABASE_URL`      | Separate database whose name ends in `_test`                                |
| `JWT_SECRET`             | Required random secret, at least 32 characters                              |
| `PORT`                   | API port, default `4000`                                                    |
| `CORS_ORIGIN`            | Browser origin, default `http://localhost:5173`                             |
| `COLLECTION_WINDOW_DAYS` | Collection deadline after marking ready, default `3`                        |
| `LOAN_PERIOD_DAYS`       | Loan duration, default `14`                                                 |
| `VITE_API_URL`           | Frontend API base; defaults to `/api` through the Vite proxy                |
| `API_PROXY_TARGET`       | Optional Vite development proxy target; defaults to `http://localhost:4000` |

The optional `apps/web/.env.example` demonstrates `VITE_API_URL=http://localhost:4000/api`. Do not put secrets in `VITE_` variables. When deploying the frontend, configure the API URL or reverse proxy and serve `index.html` for browser routes.

### Migrate and seed

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

`db:migrate` applies the checked-in migration with `prisma migrate deploy`. To create a new migration after editing the schema:

```bash
pnpm --filter @sa-library/api db:migrate --name describe_change
```

Prisma 7 generation and seeding are explicit. The seed is rerunnable: it does not reset passwords or circulation records on existing accounts. Initial seed: **18 books, 54 physical copies, four branches**, plus example active/ready reservations, active/overdue loans and borrowing history. Demo seeding is disabled when `NODE_ENV=production`.

## Start the applications

```bash
pnpm dev           # frontend, API and shared-package watcher
# Or in separate terminals:
pnpm dev:web
pnpm dev:api
```

- Web: http://localhost:5173
- API health: http://localhost:4000/api/health

Both must be running for the complete experience. Individually started apps build shared once; `pnpm dev` watches shared changes.

## Demo accounts

All use the development password **`LibraryDemo2026!`**. These are demonstration credentials only; never seed them into a production environment.

| Email                   | Access                                              |
| ----------------------- | --------------------------------------------------- |
| `member@example.com`    | Member; membership `EKU-DEMO-0001`                  |
| `librarian@example.com` | Librarian assigned to Germiston Library             |
| `admin@example.com`     | Platform admin; all branches and library management |

The library is City of Ekurhuleni Libraries, with Germiston, Boksburg, Alberton and Kempton Park demo branches. New registrations are members. For the local MVP, an active demo membership is created automatically on a member's first reservation or checkout. Real municipal membership verification is future work.

## Current V1 functionality

Members can register, sign in/out, view their profile, search by title/author/ISBN, inspect branch stock, reserve an available physical copy at a chosen branch, cancel an active/ready reservation, view loans and due dates, and view returned-book history.

Staff can see their branch totals, add books and copies, edit copy barcode/shelf/condition, mark uncommitted copies available/lost/damaged, prepare reservations, cancel them, check out ready reservations or available copies, process returns, look up members, and filter overdue loans. Checkout accepts a member email or library membership number plus a typed barcode.

Librarians only access their assigned branch. Library admins access branches in their assigned branch's library. Platform admins access all branches and can create libraries and branches. New staff assignment/user-role management is not exposed in the V1 UI.

Platform admin overview reports libraries, branches, books, copies, members and active loans. Member collection notifications are stored and displayed in My Library; there is no external email/SMS delivery.

### Circulation integrity

A reservation always identifies one physical copy at the requested pickup branch. Services use serializable Prisma transactions with bounded retries for write conflicts. PostgreSQL partial unique indexes independently prevent two live reservations or two unreturned loans for a copy. Ready reservations can only be checked out to their owner. Copy-edit endpoints cannot bypass an active circulation record.

Ready reservations expire after the configured collection window; overdue loans and copy statuses are reconciled during catalogue/circulation requests. There is no background scheduler in V1, so these transitions happen when the application is used. Changes are recorded in the audit log. See [Prisma's transaction documentation](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions) for the isolation/retry behaviour used here.

### Database models

`User`, `Library`, `LibraryBranch`, `LibraryMembership`, `Book`, `Author`, `BookAuthor`, `BookCopy`, `Reservation`, `Loan`, `Notification`, `AuditLog`.

Books are bibliographic records; copies have unique barcodes and belong to branches. Membership numbers are unique within a library. User email and ISBNs are unique. The schema includes foreign keys, access/query indexes and a loan due-date constraint. Custom partial unique indexes are included in the SQL migration.

## Pages

- Public: `/`, `/login`, `/register`, `/search`, `/books/:id`.
- Member: `/my-library`, `/my-library/reservations`, `/my-library/loans`, `/my-library/history`.
- Staff: `/staff`, `/staff/catalogue`, `/staff/reservations`, `/staff/loans`, `/staff/members`.
- Platform admin: `/admin`, `/admin/libraries`.

Book cover artwork is a locally rendered typographic placeholder when no cover URL exists; it is not an official publisher cover.

## API routes

Requests and responses use JSON; authenticated requests use `Authorization: Bearer <token>`. Errors use `{ "error": { "code": "...", "message": "..." } }` with 400/401/403/404/409/500 status codes.

| Method     | Route                               | Access / purpose                                            |
| ---------- | ----------------------------------- | ----------------------------------------------------------- |
| GET        | `/api/health`                       | Public service health                                       |
| POST       | `/api/auth/register`                | Public registration                                         |
| POST       | `/api/auth/login`                   | Public authentication                                       |
| GET        | `/api/auth/me`                      | Current database profile                                    |
| POST       | `/api/auth/logout`                  | Authenticated logout acknowledgement                        |
| GET        | `/api/libraries`                    | Public libraries and branches                               |
| GET        | `/api/books?q=...`                  | Public search; up to 200 results in this MVP                |
| GET        | `/api/books/:id`                    | Public metadata and branch availability                     |
| POST       | `/api/books`                        | Staff creates bibliographic record with `authors: string[]` |
| POST       | `/api/books/:bookId/copies`         | Staff adds physical copy                                    |
| GET        | `/api/branches/:branchId/copies`    | Staff branch inventory                                      |
| PATCH      | `/api/copies/:copyId`               | Staff edits copy metadata/non-circulating status            |
| POST       | `/api/reservations`                 | Member; `bookId`, `pickupBranchId`                          |
| GET        | `/api/reservations/me`              | Current user's active/ready reservations                    |
| DELETE     | `/api/reservations/:id`             | Owner or authorized branch staff cancels                    |
| GET        | `/api/loans/me`                     | Current user's unreturned loans                             |
| GET        | `/api/loans/history`                | Current user's returned loans                               |
| GET        | `/api/notifications/me`             | Current user's collection notifications                     |
| GET        | `/api/staff/dashboard`              | Scoped staff totals and branches                            |
| GET        | `/api/staff/members?q=...`          | Scoped members or exact-email lookup                        |
| GET        | `/api/staff/reservations`           | Scoped active/ready reservations                            |
| PATCH      | `/api/staff/reservations/:id/ready` | Mark ready, set collection deadline                         |
| POST       | `/api/staff/loans/checkout`         | `userId` + `copyId`, or `member` + `barcode`                |
| POST       | `/api/staff/loans/return`           | `copyId`                                                    |
| GET        | `/api/staff/loans?overdue=true`     | Scoped active/overdue loans                                 |
| GET        | `/api/admin/totals`                 | Platform totals                                             |
| GET / POST | `/api/admin/libraries`              | List/create libraries                                       |
| POST       | `/api/admin/libraries/:id/branches` | Create a branch                                             |

## Tests and builds

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm format:check
```

Tests use **real PostgreSQL**, never mocked reservation/loan transactions. The test runner requires a database ending in `_test`, creates a random schema, applies the real migration, runs the tests, and drops only that schema afterwards. The integration test file refuses to run without that isolation. Development inventory is untouched.

The backend suite covers authentication, validation, search, availability, role and branch permissions, catalogue administration, membership lookup, reservation ownership/expiry/cancellation, simultaneous reservations and checkouts, returns, due dates and history.

Browser tests also use a fresh migrated test schema with demo seed data. They start isolated frontend/API servers on ports 4173 and 4001 and stop them afterwards:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
# Alternatively, use installed Chrome (used in this workspace):
PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome pnpm test:e2e
```

Browser journeys cover registration and login, search and availability, reservation preparation, checkout, active loans, return/history, staff catalogue/copy editing and direct checkout, admin library/branch creation, and mobile search.

Prettier is configured with `pnpm format` and `pnpm format:check`. No separate ESLint configuration is included. Build output is in each package's `dist` directory. After building, use `pnpm --filter @sa-library/api start`; `pnpm --filter @sa-library/web preview` previews the web build and requires a configured API URL/proxy.

## V2 roadmap

- Real municipal catalogue and membership integrations; MARC imports.
- Camera barcode scanning, renewals, waiting lists and inter-branch transfers.
- Background expiry jobs and email/SMS notifications.
- Staff account/assignment administration and more advanced catalogue management.
- Pagination, richer filtering and production monitoring.
- Email verification, password recovery, refresh/revocable sessions and login rate limiting before a public launch.
- Payments, subscriptions and school textbook subscription services.
