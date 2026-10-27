# Transaction Ledger: Frontend

[← Back to project README](../README.md)

The web app for the Transaction Ledger API. It is a React single-page app where you can open accounts, post credits and debits, browse transaction history, and transfer money between accounts.

- **React 19** + **React Router** for pages
- **Vite** dev server and build
- **Tailwind CSS 4** for styling
- **Motion** (`motion/react`) for animations
- **lucide-react** icons, **sonner** toasts

## Getting started

The [backend](../backend/README.md) must be running, on `http://localhost:3000` by default.

```bash
npm install
cp .env.example .env
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`. In development the Vite server proxies `/api` and `/health` to the backend, so the app calls relative URLs and needs no CORS setup.

### Scripts

| Script            | What it does                                |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start the dev server with hot reload        |
| `npm run build`   | Production build into `dist/`               |
| `npm run preview` | Serve the production build locally          |

### Environment variables (`.env`)

| Variable            | Default                 | Purpose |
| ------------------- | ----------------------- | ------- |
| `VITE_API_URL`      | *(empty)*               | API base URL for production builds when the API is on another origin, e.g. `https://api.example.com`. Leave it empty in development. |
| `VITE_PROXY_TARGET` | `http://localhost:3000` | Backend address the dev server proxies `/api` and `/health` to |
| `VITE_CURRENCY`     | `INR`                   | ISO 4217 code used only for display formatting |

For a production deployment on a different origin:
1. Set `VITE_API_URL` before running `npm run build`.
2. Add the frontend's origin to the backend's `CORS_ORIGIN`.

## Deployment (Vercel)

1. Import the repository in Vercel and set **Root Directory** to `frontend`.
2. Set the environment variable `VITE_API_URL` to the backend URL, e.g. `https://<your-api>.onrender.com`.
3. Deploy. [`vercel.json`](vercel.json) rewrites all routes to `index.html`, so deep links like `/accounts/:id` work.
4. Add the Vercel URL to the backend's `CORS_ORIGIN`.

If the API is waking from sleep (Render free plan), the app shows a notice and reloads its data automatically once the API responds. The full guide is in the [project README](../README.md#deployment).

## Features

**Dashboard (`/`)**
- Stat cards with animated counters: total balance, account count, credit volume and debit volume.
- Account cards with search by name or id.
- Recent-activity feed across all accounts.
- Header indicator showing whether the API is online.

**Account page (`/accounts/:id`)**
- Balance card with an animated counter and one-click **Credit**, **Debit** and **Transfer**.
- Transaction history:
  - **All / Credits / Debits** tabs.
  - Pagination with page numbers and a page-size selector.
  - Newest first.
- Transfer legs are marked with a badge.

**Forms (modals)**
- **New account**: only a name. The balance always starts at 0.
- **New transaction**:
  - Credit/debit toggle and amount (at most 2 decimals).
  - Optional description.
  - A `reference_id` that is generated for you, and can be edited or regenerated.
- **Transfer**: source and destination selectors with a swap button. Shows the available balance.

**Error handling**
- Client-side checks mirror the API rules.
- Server errors are mapped back to the right field: insufficient balance, duplicate `reference_id`, validation details.
- Other errors and network failures show as toasts.

## Project structure

```
src/
├── main.jsx                 Entry point (also pauses Motion while the tab is hidden)
├── App.jsx                  Router, providers, toaster
├── index.css                Tailwind import, theme tokens, glass/aurora/shimmer styles
├── context/
│   └── LedgerContext.jsx    Data "version" for refreshes + which modal is open
├── lib/
│   ├── api.js               fetch wrapper, ApiError, endpoint functions
│   ├── format.js            Money/date formatting, reference generator, amount validation
│   └── hooks.js             useApi (data loading), useCopy, entranceInitial
├── components/
│   ├── Layout.jsx           Header, API status, animated background, page transitions
│   ├── ui.jsx               Button, Input, Field, Card, SegmentedControl, Skeleton, ...
│   ├── TransactionList.jsx  Animated transaction rows + skeleton
│   ├── Pagination.jsx       Page numbers with ellipses, page-size selector
│   ├── AnimatedNumber.jsx   Counting number animation
│   └── Modal.jsx            Animated dialog (Escape / backdrop to close)
├── modals/                  CreateAccountModal, TransactionModal, TransferModal, ModalHost
└── pages/                   Dashboard, AccountPage, NotFound
```

## How it talks to the API

- **API client.** [`src/lib/api.js`](src/lib/api.js) wraps `fetch`. A non-2xx response becomes an `ApiError` carrying the backend's `status`, `code`, `message` and `details`. Forms use `fieldErrors(err)` to turn validation `details` into inline field messages.
- **Data loading.** `useApi(loader, deps)` loads data and keeps the previous data while it reloads, so the UI never flashes back to skeletons.
- **Refreshing after a change.** Any successful create, transaction or transfer calls `refresh()` from `LedgerContext`. That bumps a shared `version` which every page includes in its fetch dependencies, so the stats, lists and balances all update together.
- **Idempotency.** The UI generates a `reference_id` for every transaction and transfer, for example `TXN-20261027-AB12CD`. If a submit is retried with the same reference, the API returns `409`, and the UI explains that nothing was charged.

## Design and animation notes

- **Look.** Dark theme with frosted-glass surfaces, a slowly drifting aurora background, and a spinning gradient border on the balance card.
- **Motion.** Spring-based buttons, modals and sliding tab indicators. Lists and cards enter with a stagger, and numbers count up.
- **Accessibility.** Respects `prefers-reduced-motion`: Motion uses `reducedMotion="user"`, and the CSS animations are disabled.
- **Hidden tabs.** Browsers pause animation frames in hidden tabs. To stop pages getting stuck invisible at their first animation frame, animations are skipped while `document.visibilityState === 'hidden'`, and staggered sections mount directly in their final state.
- **Mobile.** The layout is responsive down to phone width (375px) with no horizontal scrolling. Modals become bottom sheets on small screens.
