# Transaction Ledger

A full-stack transaction ledger: create accounts, post credit and debit transactions, view balances and paginated transaction history, and transfer money between accounts atomically.

Every balance is the exact result of its transactions. Writes are atomic, duplicate submissions are detected by `reference_id`, overdrafts are impossible even under concurrent requests, and transactions can never be edited or deleted.

| Part | Stack | Docs |
| ---- | ----- | ---- |
| **Backend** | Node.js 22+, Express 5, MongoDB (Mongoose), Zod | [backend/README.md](backend/README.md) · [API reference](backend/docs/API.md) |
| **Frontend** | React 19, Vite, Tailwind CSS 4, Motion, React Router | [frontend/README.md](frontend/README.md) |

## Live demo

- **App:** https://ledger-account-one.vercel.app
- **API:** https://ledger-lbn5.onrender.com (status: https://ledger-lbn5.onrender.com/health)

The API runs on Render's free plan and sleeps when idle. The first request after a quiet period can take up to a minute; the app shows a "waking up" notice and loads the data once the server responds.

## Run locally

Requires Node.js 22+ and Git.

### 1. Fork and clone

Fork [suhailullakhan619/ledger](https://github.com/suhailullakhan619/ledger) on GitHub, then clone your fork:

```bash
git clone https://github.com/<your-username>/ledger.git
cd ledger
```

### 2. Get the database credentials

The `.env` files are not in the repository, because they hold the MongoDB password. To use the same MongoDB Atlas cluster as the live demo, email **suhailullakhan619@gmail.com** and ask for the credentials.

You can also use your own Atlas cluster (the free M0 tier works) or run without a cluster; see [No database?](#no-database) below.

### 3. Backend (terminal 1)

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and fill it in as `.env.example` shows, using the credentials you received:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=ledger
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

Then start the API:

```bash
npm start
```

The API runs on `http://localhost:3000`. Check that `http://localhost:3000/health` returns `{"status":"ok","database":"connected"}`.

### 4. Frontend (terminal 2)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Keep `VITE_API_URL` empty in `frontend/.env`, as in `.env.example`. The dev server then proxies `/api` to your local backend on port 3000. Open `http://localhost:5173`.

### No database?

Run the backend with `npm run dev:memory` instead of `npm start`. It uses a temporary in-memory MongoDB, so it needs no credentials. Data is lost when the process stops, and the first run downloads a MongoDB binary.

More detail (tests, environment variables) is in [Quick start](#quick-start) below.

## Features

- **Accounts**: created with a system-generated id and timestamp. The balance always starts at 0 and clients cannot set it.
- **Credit / debit transactions**:
  - Amounts must be greater than 0, with at most 2 decimals.
  - A debit is rejected when the balance is insufficient.
- **Idempotency**: a repeated `reference_id` on the same account returns `409` and changes nothing. The same reference may be used on different accounts.
- **Transaction history**:
  - Filter by `credit` / `debit`.
  - Paginate with `page` / `limit`; responses include the total record and page counts.
  - Sorted newest first.
- **Data integrity**:
  - Multi-document MongoDB transactions.
  - Conditional balance updates, so concurrent debits cannot overdraw an account.
  - Unique indexes and `$jsonSchema` validators.
  - Transactions are immutable.
- **Transfers (bonus)**: the debit, the credit and the transfer record commit together or not at all.
- **Errors**: a consistent JSON error envelope with meaningful HTTP status codes.
- **UI**:
  - Dashboard with animated totals and a recent-activity feed.
  - Account pages with history filters and pagination.
  - Forms for credits, debits and transfers, with inline validation errors.
  - Toast notifications.
  - Works at phone width.

## Repository structure

```
ledger/
├── backend/            REST API (Express + MongoDB)
│   ├── src/            app, models, repositories, services, routes, middleware
│   ├── tests/          end-to-end API tests (in-memory MongoDB)
│   ├── scripts/        dev:memory runner
│   └── docs/           API.md, requests.http
└── frontend/           Web app (React + Vite)
    └── src/            pages, components, modals, API client
```

## Quick start

**Prerequisites:**
- Node.js 22 or newer.
- A MongoDB **replica set**. Any [MongoDB Atlas](https://www.mongodb.com/atlas) cluster works, including the free M0 tier. The API uses multi-document transactions, which a standalone `mongod` does not support.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and set `MONGODB_URI` to your connection string. URL-encode special characters in the password: `@` becomes `%40`.

```bash
npm start
```

The API runs on `http://localhost:3000`.

> **No database yet?** `npm run dev:memory` runs the API on a temporary in-memory MongoDB replica set. Data is lost on exit, and the first run downloads a MongoDB binary.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`. The dev server proxies `/api` to the backend, so you don't need to configure CORS.

### 3. Tests

```bash
cd backend
npm test
```

The tests run against an in-memory MongoDB replica set, so they need no cluster.

## API at a glance

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `POST` | `/api/accounts` | Create an account |
| `GET`  | `/api/accounts` | List accounts (paginated) |
| `GET`  | `/api/accounts/:id` | Get an account |
| `GET`  | `/api/accounts/:id/balance` | Get the current balance |
| `POST` | `/api/accounts/:id/transactions` | Add a credit or debit |
| `GET`  | `/api/accounts/:id/transactions?type=&page=&limit=` | Transaction history |
| `GET`  | `/api/accounts/:id/transactions/:txnId` | Get one transaction |
| `POST` | `/api/transfers` | Transfer between accounts |
| `GET`  | `/api/stats` | Dashboard totals and recent activity |
| `GET`  | `/health` | Health check, including database status |
| `GET`  | `/api/status` | Same as `/health`; the frontend polls this one, since some ad blockers block `/health` |

Request and response examples, error codes and validation rules are in [backend/docs/API.md](backend/docs/API.md).

## Deployment

The backend runs on **Render** and the frontend on **Vercel**; both deploy from this repository.

The live URLs are listed under [Live demo](#live-demo).

### 1. MongoDB Atlas

In **Network Access**, add `0.0.0.0/0` (allow from anywhere). Render's free plan has no fixed outbound IP address. Access is still protected by the database username and password.

### 2. Backend on Render

The repo includes a Blueprint, [`render.yaml`](render.yaml).

1. In the Render dashboard, choose **New → Blueprint** and select this repository.
2. Fill in the prompted environment variables:
   - `MONGODB_URI`: your Atlas connection string, with the password URL-encoded.
   - `CORS_ORIGIN`: your Vercel URL. Add a wildcard entry for preview deployments, e.g. `https://your-app.vercel.app,https://your-app-*.vercel.app`. You can set this after step 3.
3. Deploy, then confirm `https://<your-api>.onrender.com/health` returns `{"status":"ok","database":"connected"}`.

> The free plan sleeps after 15 minutes of inactivity, so the first request then takes up to about a minute. The frontend shows a "waking up the API server" notice and loads the data automatically once the server is up.

### 3. Frontend on Vercel

1. In the Vercel dashboard, choose **Add New → Project** and import this repository.
2. Set **Root Directory** to `frontend`. The framework (Vite) is detected; [`frontend/vercel.json`](frontend/vercel.json) adds the SPA rewrite so deep links like `/accounts/:id` work.
3. Add the environment variable `VITE_API_URL` = `https://<your-api>.onrender.com`.
4. Deploy, then put the Vercel URL into Render's `CORS_ORIGIN`. Render redeploys automatically.

## More details

- **[backend/README.md](backend/README.md)** covers:
  - Configuration and environment variables.
  - How atomicity, idempotency, immutability and concurrency safety are implemented.
  - Project layout, scripts and the full list of **assumptions**.
- **[frontend/README.md](frontend/README.md)** covers:
  - Setup, environment variables and scripts.
  - Project layout.
  - How the UI talks to the API, plus design and animation notes.
- **[backend/docs/API.md](backend/docs/API.md)** is the endpoint-by-endpoint API documentation.
