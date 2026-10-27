const CURRENCY = import.meta.env.VITE_CURRENCY || 'INR';

const money = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const currencySymbol =
  money.formatToParts(0).find((p) => p.type === 'currency')?.value ?? CURRENCY;

export function formatMoney(value, { compact = false } = {}) {
  const n = Number(value) || 0;
  return compact && Math.abs(n) >= 100000 ? compactMoney.format(n) : money.format(n);
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function formatDateTime(iso) {
  return dateTime.format(new Date(iso));
}

export function timeAgo(iso) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 604800) return relative.format(Math.round(seconds / 86400), 'day');
  return formatDateTime(iso);
}

export function shortId(id) {
  return id ? `${id.slice(0, 6)}…${id.slice(-4)}` : '';
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?';
}

const GRADIENTS = [
  'from-indigo-500 to-violet-500',
  'from-cyan-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-fuchsia-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-sky-500 to-indigo-500',
];

export function gradientFor(seed = '') {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** Client-generated idempotency key; the user can edit or regenerate it. */
export function newReference(prefix = 'TXN') {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

/** Client-side amount check mirroring the API rules (> 0, max 2 decimals). */
export function amountError(raw) {
  if (raw === '' || raw === null || raw === undefined) return 'Amount is required';
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Enter a valid number';
  if (n <= 0) return 'Amount must be greater than 0';
  if (!/^\d+(\.\d{1,2})?$/.test(String(raw).trim())) return 'Use at most 2 decimal places';
  return null;
}
