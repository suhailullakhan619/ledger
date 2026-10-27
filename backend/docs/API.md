# API Documentation

Base URL: `http://localhost:3000`

All request and response bodies are JSON. Send `Content-Type: application/json` on `POST` requests.

## Conventions

### Success envelope

Single resources are wrapped in `data`:

```json
{ "data": { ... } }
```

### Error envelope

Every error uses the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [{ "field": "amount", "message": "amount must be greater than 0" }]
  }
}
```

`details` is optional. For validation errors it is a list of `{ field, message }`; for other errors it is an object with context (e.g. the existing transaction on a duplicate).

### Error codes

| HTTP | `code`                  | When                                                                 |
| ---- | ----------------------- | -------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`      | Missing/invalid fields, unknown fields, invalid query params         |
| 400  | `INVALID_JSON`          | Request body is not valid JSON                                       |
| 400  | `VALIDATION_ERROR`      | Malformed id in the path or body (ids are 24-char hex ObjectIds)     |
| 404  | `ACCOUNT_NOT_FOUND`     | Account id is well-formed but does not exist                         |
| 404  | `NOT_FOUND`             | Transaction id does not exist for the account                        |
| 404  | `ROUTE_NOT_FOUND`       | Unknown endpoint                                                     |
| 405  | `METHOD_NOT_ALLOWED`    | Attempt to edit/delete a transaction (transactions are immutable)    |
| 409  | `DUPLICATE_TRANSACTION` | `reference_id` already used for this account (or source of transfer) |
| 413  | `PAYLOAD_TOO_LARGE`     | Body larger than 100 kb                                              |
| 422  | `INSUFFICIENT_BALANCE`  | Debit / transfer amount exceeds the available balance                |
| 500  | `INTERNAL_SERVER_ERROR` | Unexpected server error                                              |

### Amounts

- JSON numbers (not strings), greater than `0`, at most 2 decimal places, at most `1,000,000,000,000`.
- Stored internally as integer minor units (cents/paise), so `0.1 + 0.2` is exactly `0.3`.

---

## 1. Create account

`POST /api/accounts`

Request:

```json
{ "name": "Alice" }
```

| Field  | Type   | Rules                                         |
| ------ | ------ | --------------------------------------------- |
| `name` | string | Required, trimmed, 1–200 characters           |

Any other field (`id`, `balance`, `created_at`, ...) is rejected with `400 VALIDATION_ERROR`. The account always starts with balance `0`.

Response `201 Created` (also sets a `Location` header):

```json
{
  "data": {
    "id": "6720f1a2c4b9e31d5a7f0c11",
    "name": "Alice",
    "balance": 0,
    "created_at": "2026-10-27T13:05:12.345Z"
  }
}
```

Errors: `400 VALIDATION_ERROR`, `400 INVALID_JSON`.

---

## List accounts

`GET /api/accounts?page=1&limit=10`

Latest first. Same `page`/`limit` rules and `pagination` object as transaction history.

```json
{
  "data": [{ "id": "6720f1a2c4b9e31d5a7f0c11", "name": "Alice", "balance": 100, "created_at": "2026-10-27T13:05:12.345Z" }],
  "pagination": { "page": 1, "limit": 10, "total_records": 1, "total_pages": 1, "has_next_page": false, "has_previous_page": false }
}
```

---

## Get account

`GET /api/accounts/:accountId`

Response `200 OK`: same shape as create. Errors: `404 ACCOUNT_NOT_FOUND`.

---

## 2. Add transaction

`POST /api/accounts/:accountId/transactions`

Request:

```json
{
  "type": "credit",
  "amount": 50,
  "description": "Salary",
  "reference_id": "INV-1001"
}
```

| Field          | Type   | Rules                                                      |
| -------------- | ------ | ---------------------------------------------------------- |
| `type`         | string | Required, `credit` or `debit`                              |
| `amount`       | number | Required, > 0, max 2 decimals                              |
| `description`  | string | Optional (may be `null`), max 500 characters               |
| `reference_id` | string | Required, 1–100 characters, unique per account             |

Response `201 Created`:

```json
{
  "data": {
    "id": "6720f1b8c4b9e31d5a7f0c19",
    "account_id": "6720f1a2c4b9e31d5a7f0c11",
    "type": "credit",
    "amount": 50,
    "description": "Salary",
    "reference_id": "INV-1001",
    "created_at": "2026-10-27T13:06:00.000Z"
  },
  "meta": { "balance": 150 }
}
```

`meta.balance` is the account balance after the transaction.

Errors:

- `400 VALIDATION_ERROR` — bad type, amount, missing `reference_id`, unknown fields.
- `404 ACCOUNT_NOT_FOUND`
- `409 DUPLICATE_TRANSACTION` — same `reference_id` already exists for this account. No transaction is created and the balance is unchanged. The original transaction is returned in `error.details.existing_transaction`:

  ```json
  {
    "error": {
      "code": "DUPLICATE_TRANSACTION",
      "message": "A transaction with reference_id 'INV-1001' already exists for this account",
      "details": { "existing_transaction": { "id": "6720f1b8c4b9e31d5a7f0c19", "...": "..." } }
    }
  }
  ```

- `422 INSUFFICIENT_BALANCE` — debit larger than the balance. Balance unchanged.

  ```json
  {
    "error": {
      "code": "INSUFFICIENT_BALANCE",
      "message": "Insufficient balance for this debit",
      "details": { "account_id": "6720f1a2c4b9e31d5a7f0c11", "balance": 100, "requested_amount": 150 }
    }
  }
  ```

---

## 3. Get account balance

`GET /api/accounts/:accountId/balance`

Response `200 OK`:

```json
{ "data": { "account_id": "6720f1a2c4b9e31d5a7f0c11", "balance": 100 } }
```

Errors: `404 ACCOUNT_NOT_FOUND`.

---

## 4. Get transaction history

`GET /api/accounts/:accountId/transactions?type=credit&page=1&limit=10`

| Query   | Default | Rules                                                     |
| ------- | ------- | --------------------------------------------------------- |
| `type`  | (all)   | Optional, `credit` or `debit`. Omitted → both types        |
| `page`  | `1`     | Integer ≥ 1                                               |
| `limit` | `10`    | Integer 1–100                                             |

Results are sorted **latest first** by `created_at` (ties broken by insertion order).

Response `200 OK`:

```json
{
  "data": [
    {
      "id": "...",
      "account_id": "...",
      "type": "debit",
      "amount": 20,
      "description": null,
      "reference_id": "t4",
      "created_at": "2026-10-27T13:10:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total_records": 4,
    "total_pages": 1,
    "has_next_page": false,
    "has_previous_page": false
  },
  "filters": { "type": null }
}
```

A page beyond the last page returns an empty `data` array (not an error).

Errors: `400 VALIDATION_ERROR` (e.g. `page=0`, `limit=500`, `type=refund`), `404 ACCOUNT_NOT_FOUND`.

---

## Get a single transaction

`GET /api/accounts/:accountId/transactions/:transactionId`

Response `200 OK`: `{ "data": { ...transaction } }`. Errors: `404 ACCOUNT_NOT_FOUND`, `404 NOT_FOUND`.

### Immutability

`PUT`, `PATCH` and `DELETE` on `/api/accounts/:accountId/transactions` or `/api/accounts/:accountId/transactions/:transactionId` return `405 METHOD_NOT_ALLOWED` with an `Allow` header. The Mongoose models also block every update/delete query on transactions and transfers.

---

## 9. Transfer money (bonus)

`POST /api/transfers`

Request:

```json
{
  "from_account_id": "6720f1a2c4b9e31d5a7f0c11",
  "to_account_id": "6720f1a9c4b9e31d5a7f0c15",
  "amount": 30,
  "description": "Rent share",
  "reference_id": "TRF-001"
}
```

| Field             | Type   | Rules                                                    |
| ----------------- | ------ | -------------------------------------------------------- |
| `from_account_id` | string | Required, must exist                                     |
| `to_account_id`   | string | Required, must exist, different from `from_account_id`   |
| `amount`          | number | Required, > 0, max 2 decimals                            |
| `description`     | string | Optional                                                 |
| `reference_id`    | string | Required, unique per source account                      |

The transfer creates a `debit` on the source and a `credit` on the destination, both carrying the transfer's `reference_id` and `transfer_id`. The transfer record and both legs run in one database transaction: if anything fails, nothing is persisted.

Response `201 Created`:

```json
{
  "data": {
    "transfer": {
      "id": "6720f2c0c4b9e31d5a7f0c2a",
      "from_account_id": "6720f1a2c4b9e31d5a7f0c11",
      "to_account_id": "6720f1a9c4b9e31d5a7f0c15",
      "amount": 30,
      "description": "Rent share",
      "reference_id": "TRF-001",
      "created_at": "2026-10-27T13:20:00.000Z"
    },
    "transactions": {
      "debit":  { "id": "...", "account_id": "6720f1a2c4b9e31d5a7f0c11", "type": "debit",  "amount": 30, "transfer_id": "6720f2c0c4b9e31d5a7f0c2a", "...": "..." },
      "credit": { "id": "...", "account_id": "6720f1a9c4b9e31d5a7f0c15", "type": "credit", "amount": 30, "transfer_id": "6720f2c0c4b9e31d5a7f0c2a", "...": "..." }
    },
    "balances": {
      "from_account": { "account_id": "6720f1a2c4b9e31d5a7f0c11", "balance": 70 },
      "to_account":   { "account_id": "6720f1a9c4b9e31d5a7f0c15", "balance": 80 }
    }
  }
}
```

Errors: `400 VALIDATION_ERROR`, `404 ACCOUNT_NOT_FOUND`, `409 DUPLICATE_TRANSACTION`, `422 INSUFFICIENT_BALANCE`.

---

## Dashboard stats

`GET /api/stats`

```json
{
  "data": {
    "total_accounts": 2,
    "total_balance": 150,
    "transactions": { "total": 3, "credit_count": 2, "debit_count": 1, "credit_volume": 180, "debit_volume": 30 },
    "recent_transactions": [{ "id": "...", "account_id": "...", "type": "debit", "amount": 30, "...": "..." }]
  }
}
```

`recent_transactions` holds the 8 most recent transactions across all accounts.

---

## Health check

`GET /health` → `200 { "status": "ok", "database": "connected" }`, or `503` with `"status": "degraded"` when MongoDB is unreachable.

---

## curl walkthrough

```bash
# Create two accounts
A=$(curl -s -X POST localhost:3000/api/accounts -H 'Content-Type: application/json' -d '{"name":"Alice"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.id')
B=$(curl -s -X POST localhost:3000/api/accounts -H 'Content-Type: application/json' -d '{"name":"Bob"}'   | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.id')

# Credit and debit
curl -s -X POST localhost:3000/api/accounts/$A/transactions -H 'Content-Type: application/json' \
  -d '{"type":"credit","amount":100,"reference_id":"r1","description":"Opening deposit"}'
curl -s -X POST localhost:3000/api/accounts/$A/transactions -H 'Content-Type: application/json' \
  -d '{"type":"debit","amount":30,"reference_id":"r2"}'

# Balance and history
curl -s localhost:3000/api/accounts/$A/balance
curl -s "localhost:3000/api/accounts/$A/transactions?type=debit&page=1&limit=5"

# Transfer
curl -s -X POST localhost:3000/api/transfers -H 'Content-Type: application/json' \
  -d "{\"from_account_id\":\"$A\",\"to_account_id\":\"$B\",\"amount\":20,\"reference_id\":\"tr1\"}"
```

A ready-to-use request file for the VS Code REST Client / JetBrains HTTP client is in [`requests.http`](requests.http).
