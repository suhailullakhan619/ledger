# Transaction Ledger: Backend

[← Back to project README](../README.md) · [Frontend README](../frontend/README.md)

A backend API for a simple transaction ledger. It lets you create accounts, post credit and debit transactions, read balances and paginated transaction history, and transfer money between accounts atomically.

- **Runtime:** Node.js (>= 22) + Express 5
- **Database:** MongoDB via Mongoose. The server must be a **replica set**, because the API uses multi-document transactions. Every MongoDB Atlas cluster is a replica set.
- **Validation:** Zod
- **Tests:** Node's built-in test runner + Supertest + `mongodb-memory-server`

Full endpoint reference: [docs/API.md](docs/API.md).

## Running locally

```bash
npm install
```

Then copy `.env.example` to `.env` (a `.env` with an empty `MONGODB_URI` is already included) and set your connection string:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=ledger
```

Start the server:

```bash
npm start
```

The API listens on `http://localhost:3000`. On startup it creates the collections with MongoDB `$jsonSchema` validators and builds all indexes.

### No cluster yet?

```bash
npm run dev:memory
```

This starts the API against a throwaway in-memory MongoDB replica set. The first run downloads a MongoDB binary, which is several hundred MB. Data is lost when the process stops.

### Environment variables

| Variable          | Default                 | Purpose                                         |
| ----------------- | ----------------------- | ----------------------------------------------- |
| `MONGODB_URI`     | *(required)*            | MongoDB connection string (replica set)         |
| `MONGODB_DB_NAME` | `ledger`                | Database name                                   |
| `MONGODB_CONNECT_RETRIES` | `5`             | Startup connection retries (exponential backoff, 15 s cap). Auth and malformed-URI errors fail immediately |
| `MONGODB_RETRY_DELAY_MS`  | `1000`          | First retry delay; doubles each attempt         |
| `PORT`            | `3000`                  | HTTP port                                       |
| `CORS_ORIGIN`     | `http://localhost:5173` | Allowed browser origins, comma separated. `*` inside an entry is a wildcard, e.g. `https://app-*.vercel.app`. A bare `*` allows any origin |

### Scripts

| Script               | What it does                                       |
| -------------------- | -------------------------------------------------- |
| `npm start`          | Run the API using `MONGODB_URI`                    |
| `npm run dev`        | Same, restarting on file changes                   |
| `npm run dev:memory` | Run the API on an in-memory replica set            |
| `npm test`           | Run the test suite (in-memory replica set)         |

## Deployment

Deployed on Render with the Blueprint in [`../render.yaml`](../render.yaml): the build runs `npm ci --omit=dev`, the start command is `npm start`, and Render's health check uses `/health`. The step-by-step guide, including Atlas network access and CORS for Vercel, is in the [project README](../README.md#deployment).

## Endpoints

| Method | Path                                                   | Purpose                           |
| ------ | ------------------------------------------------------ | --------------------------------- |
| POST   | `/api/accounts`                                        | Create account                    |
| GET    | `/api/accounts`                                        | List accounts (`page`, `limit`)   |
| GET    | `/api/accounts/:accountId`                             | Get account                       |
| GET    | `/api/accounts/:accountId/balance`                     | Get balance                       |
| POST   | `/api/accounts/:accountId/transactions`                | Add credit / debit                |
| GET    | `/api/accounts/:accountId/transactions`                | History (`type`, `page`, `limit`) |
| GET    | `/api/accounts/:accountId/transactions/:transactionId` | Get one transaction               |
| POST   | `/api/transfers`                                       | Transfer between accounts (bonus) |
| GET    | `/api/stats`                                           | Dashboard totals + recent activity |
| GET    | `/health`                                              | Health check (incl. DB status)    |
| GET    | `/api/status`                                          | Same as `/health`; used by the frontend |

## Project structure

```
src/
  server.js                 # Entry point: connects to MongoDB, starts HTTP server
  app.js                    # Express app: middleware + routes
  config.js                 # Env-based configuration
  db.js                     # Connection, collection/index setup, transaction helper
  errors.js                 # AppError hierarchy (status + code)
  models/                   # Mongoose schemas, indexes, $jsonSchema validators, immutability plugin
  repositories/             # Data access (all writes accept a session)
  services/                 # Business rules (balance checks, idempotency, atomicity)
  routes/                   # HTTP layer
  validators/schemas.js     # Zod request schemas
  middleware/               # Validation, ObjectId param checks, error handling
  utils/money.js            # Decimal <-> minor unit conversion
scripts/dev-memory.js       # Run against an in-memory replica set
tests/api.test.js           # End-to-end API tests
docs/API.md                 # API documentation
docs/requests.http          # Sample requests (REST Client)
```

## How the requirements are met

### Data integrity

- **Atomicity.** Each transaction runs inside a MongoDB multi-document transaction (`session.withTransaction`). The transaction document insert and the account `$inc` commit together, or neither does. A transfer puts the transfer record, the debit and the credit in one transaction, so a partial transfer cannot exist.
- **No overdraft, even under concurrency.** A debit is a conditional update: `updateOne({ _id, balance: { $gte: amount } }, { $inc: { balance: -amount } })`. If no document matches, the debit is rejected. Concurrent writers on the same account hit a write conflict, and the driver retries them. A test fires 10 parallel debits at one account to check this.
- **Duplicates / idempotency.** There is a unique index on `transactions { account_id, reference_id }` and on `transfers { from_account_id, reference_id }`. The service checks first so it can return the existing record; the unique index guards against races. A test sends 5 parallel requests with the same reference: exactly one succeeds.
- **Immutability.** There are no update or delete endpoints; such requests get `405`. A Mongoose plugin also blocks every update and delete query, and re-saves of existing documents, on the `Transaction` and `Transfer` models. All their fields are marked `immutable`.
- **Database-level validators.** Each collection has a `$jsonSchema` validator: `balance >= 0`, `amount >= 1` (in minor units), `type` in `credit`/`debit`, and required fields.
- **Money precision.** Amounts are stored as integer minor units (cents), so there is no float drift.

### Sorting

History is ordered by `created_at DESC, _id DESC`. Compound indexes back both the unfiltered and the type-filtered queries.

### Validation and errors

Every body, query string and path id is validated. Malformed ids get `400`; well-formed ids that don't exist get `404`. All errors share one envelope, `{ "error": { "code", "message", "details?" } }`. See the error table in [docs/API.md](docs/API.md#error-codes).

## Assumptions

1. **IDs** are MongoDB ObjectIds, returned as 24-character hex strings. A malformed id returns `400 VALIDATION_ERROR`; an unknown id returns `404`.
2. **A client-supplied `balance`, `id` or `created_at` on account creation is rejected** with `400`, not silently ignored. The same strict rule applies to unknown fields on every POST body.
3. **Amounts** must be JSON numbers (not strings), greater than 0, with at most 2 decimal places. The maximum per request is 1,000,000,000,000. Balances are returned as numbers in major units.
4. **Single currency.** There is no currency field; the frontend picks a display currency.
5. **A duplicate `reference_id`** returns `409 Conflict` with the existing transaction in `error.details`. The balance never changes.
6. **Rejected transactions are not stored.** Their `reference_id` is not consumed and can be retried.
7. **Insufficient balance** returns `422 Unprocessable Entity`.
8. **Pagination:** `page` defaults to 1 and `limit` defaults to 10, with a maximum of 100. Invalid values return `400`. A page past the end returns an empty list.
9. **`type` filter** accepts only `credit` or `debit`.
10. **`description`** is optional, up to 500 characters.
11. **Transfers:** the source and destination must differ. Both legs reuse the transfer's `reference_id` and carry a `transfer_id`. If either account already used that reference, the whole transfer is rolled back with `409`.
12. **No authentication.** This is out of scope.
13. **Accounts cannot be deleted.**
14. **Timestamps** are ISO-8601 UTC, set by the server.
15. **A replica set is required.** A standalone `mongod` does not support transactions, so the API would fail on the first write. Use Atlas, a local replica set, or `npm run dev:memory`.
16. **`collMod` permissions:** if the collections already exist and the database user lacks `collMod` rights, the validators are not updated. The app logs a warning and still runs. Mongoose validation and the unique indexes still apply.
