import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowUpRight, Inbox, Layers, RefreshCw, SearchX } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { formatDateTime, formatMoney, gradientFor, initials } from '../lib/format';
import { useLedger } from '../context/LedgerContext';
import AnimatedNumber from '../components/AnimatedNumber';
import TransactionList, { TransactionListSkeleton } from '../components/TransactionList';
import Pagination from '../components/Pagination';
import { Button, Card, CopyButton, EmptyState, ErrorBanner, SegmentedControl, Skeleton, cx } from '../components/ui';

const FILTERS = [
  { value: undefined, label: 'All', icon: Layers },
  { value: 'credit', label: 'Credits', icon: ArrowDownLeft, activeClass: 'bg-emerald-500/15 ring-1 ring-emerald-400/30' },
  { value: 'debit', label: 'Debits', icon: ArrowUpRight, activeClass: 'bg-rose-500/15 ring-1 ring-rose-400/30' },
];

export default function AccountPage() {
  const { id } = useParams();
  const { version, refresh, openModal } = useLedger();
  const [type, setType] = useState(undefined);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Reset paging when switching accounts or filters.
  useEffect(() => setPage(1), [id, type, limit]);

  const account = useApi(() => api.getAccount(id), [id, version]);
  const txns = useApi(() => api.listTransactions(id, { type, page, limit }), [id, type, page, limit, version]);

  if (account.error && (account.error.status === 404 || account.error.status === 400)) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={SearchX}
          title="Account not found"
          description={account.error.message}
          action={
            <Link to="/">
              <Button variant="secondary" icon={ArrowLeft}>
                Back to dashboard
              </Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const acc = account.data;
  const filterLabel = type ? `${type} ` : '';

  return (
    <div className="space-y-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white">
        <ArrowLeft className="size-4" /> All accounts
      </Link>

      <ErrorBanner error={account.error} onRetry={refresh} />

      {/* Balance hero */}
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="gradient-border glass relative overflow-clip rounded-3xl p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-gradient-to-br from-indigo-500/30 via-fuchsia-500/20 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 size-64 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {acc ? (
                <div className={cx('grid size-14 place-items-center rounded-2xl bg-gradient-to-br font-display text-lg font-semibold text-white shadow-xl', gradientFor(acc.id))}>
                  {initials(acc.name)}
                </div>
              ) : (
                <Skeleton className="size-14 rounded-2xl" />
              )}
              <div className="min-w-0">
                {acc ? (
                  <>
                    <h1 className="truncate font-display text-2xl font-semibold text-white sm:text-3xl">{acc.name}</h1>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1 font-mono">
                        {acc.id}
                        <CopyButton text={acc.id} label="Copy account ID" />
                      </span>
                      <span>Opened {formatDateTime(acc.created_at)}</span>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Available balance</p>
              <div className="mt-2 font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                {acc ? <AnimatedNumber value={acc.balance} format={(v) => formatMoney(v)} duration={1.1} /> : <Skeleton className="h-14 w-64" />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
            <Button variant="credit" icon={ArrowDownLeft} disabled={!acc} onClick={() => openModal('transaction', { account: acc, initialType: 'credit' })}>
              Credit
            </Button>
            <Button variant="debit" icon={ArrowUpRight} disabled={!acc} onClick={() => openModal('transaction', { account: acc, initialType: 'debit' })}>
              Debit
            </Button>
            <Button variant="secondary" icon={ArrowLeftRight} disabled={!acc} onClick={() => openModal('transfer', { fromAccountId: acc.id })}>
              Transfer
            </Button>
          </div>
        </div>
      </motion.section>

      {/* History */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-semibold text-white">Transaction history</h2>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={cx('size-4', txns.loading && 'animate-spin')} />
            </button>
          </div>
          <SegmentedControl options={FILTERS} value={type} onChange={setType} layoutId="history-filter" />
        </div>

        <ErrorBanner error={txns.error} onRetry={refresh} />

        <Card className="overflow-clip">
          <div className={cx('p-2 transition-opacity duration-200', txns.loading && txns.data && 'opacity-60')}>
            {txns.loading && !txns.data ? (
              <TransactionListSkeleton rows={limit > 6 ? 6 : limit} />
            ) : txns.data?.data.length ? (
              <TransactionList transactions={txns.data.data} listKey={`${type}-${page}-${limit}`} />
            ) : (
              <EmptyState
                icon={Inbox}
                title={type ? `No ${filterLabel}transactions` : 'No transactions yet'}
                description={type ? 'Try a different filter.' : 'Credit this account to get started.'}
                action={
                  !type && acc ? (
                    <Button variant="credit" icon={ArrowDownLeft} onClick={() => openModal('transaction', { account: acc, initialType: 'credit' })}>
                      Add first credit
                    </Button>
                  ) : null
                }
              />
            )}
          </div>
          {txns.data && txns.data.pagination.total_records > 0 && (
            <Pagination pagination={txns.data.pagination} onPageChange={setPage} limit={limit} onLimitChange={setLimit} />
          )}
        </Card>
      </section>
    </div>
  );
}
