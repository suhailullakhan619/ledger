import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, Plus, Search, Users, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { entranceInitial, useApi } from '../lib/hooks';
import { formatMoney, gradientFor, initials, shortId, timeAgo } from '../lib/format';
import { useLedger } from '../context/LedgerContext';
import AnimatedNumber from '../components/AnimatedNumber';
import TransactionList, { TransactionListSkeleton } from '../components/TransactionList';
import { Button, Card, EmptyState, ErrorBanner, Skeleton, cx } from '../components/ui';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

function StatCard({ icon: Icon, label, value, format, sub, tone }) {
  const tones = {
    indigo: 'from-indigo-500/25 text-indigo-300',
    emerald: 'from-emerald-500/25 text-emerald-300',
    rose: 'from-rose-500/25 text-rose-300',
    cyan: 'from-cyan-500/25 text-cyan-300',
  };
  return (
    <motion.div variants={item} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
      <Card className="group relative h-full overflow-clip p-5">
        <div className={cx('pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br to-transparent opacity-60 blur-2xl transition-opacity group-hover:opacity-100', tones[tone])} />
        <div className="relative flex items-center justify-between">
          <span className="text-sm font-medium text-slate-400">{label}</span>
          <span className={cx('grid size-9 place-items-center rounded-xl bg-white/[0.05] ring-1 ring-white/10', tones[tone].split(' ')[1])}>
            <Icon className="size-[18px]" />
          </span>
        </div>
        <div className="relative mt-4 font-display text-[1.7rem] font-semibold leading-none tracking-tight text-white">
          {value === undefined ? <Skeleton className="h-8 w-32" /> : <AnimatedNumber value={value} format={format} />}
        </div>
        {sub && <p className="relative mt-2 text-xs text-slate-500">{sub}</p>}
      </Card>
    </motion.div>
  );
}

function AccountCard({ account }) {
  return (
    <motion.div variants={item} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
      <Link
        to={`/accounts/${account.id}`}
        className="glass group relative block overflow-clip rounded-2xl p-5 outline-none transition-[border-color,box-shadow] duration-300 hover:border-indigo-400/30 hover:shadow-xl hover:shadow-indigo-500/10 focus-visible:ring-2 focus-visible:ring-indigo-400/70"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-transparent to-cyan-500/0 transition-colors duration-500 group-hover:from-indigo-500/10 group-hover:to-cyan-500/5" />
        <div className="relative flex items-center gap-3">
          <div className={cx('grid size-11 place-items-center rounded-xl bg-gradient-to-br font-display text-sm font-semibold text-white shadow-lg', gradientFor(account.id))}>
            {initials(account.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{account.name}</p>
            <p className="font-mono text-xs text-slate-500">{shortId(account.id)}</p>
          </div>
          <ChevronRight className="size-4 text-slate-600 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-slate-300" />
        </div>
        <div className="relative mt-5 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Balance</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums text-white">{formatMoney(account.balance)}</p>
          </div>
          <p className="text-xs text-slate-500">Opened {timeAgo(account.created_at)}</p>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard() {
  const { version, openModal } = useLedger();
  const stats = useApi(() => api.stats(), [version]);
  const accounts = useApi(() => api.listAccounts({ page: 1, limit: 100 }), [version]);
  const [query, setQuery] = useState('');

  const list = accounts.data?.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((a) => a.name.toLowerCase().includes(q) || a.id.includes(q)) : list;
  }, [list, query]);
  const names = useMemo(() => Object.fromEntries(list.map((a) => [a.id, a.name])), [list]);

  const s = stats.data;
  const money = (v) => formatMoney(v, { compact: true });

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
            <span className="size-1.5 rounded-full bg-emerald-400" /> Atomic · Idempotent · Immutable
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl"
          >
            Your money, <span className="text-gradient">perfectly balanced.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-3 max-w-xl text-slate-400">
            Open accounts, post credits and debits, and move funds between accounts. Every entry is permanent and every balance adds up.
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex gap-2">
          <Button variant="secondary" icon={ArrowLeftRight} onClick={() => openModal('transfer')}>
            Transfer
          </Button>
          <Button icon={Plus} onClick={() => openModal('create-account')}>
            New account
          </Button>
        </motion.div>
      </section>

      <ErrorBanner error={stats.error || accounts.error} />

      {/* Stats */}
      <motion.section variants={container} initial={entranceInitial()} animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} tone="indigo" label="Total balance" value={s?.total_balance} format={money} sub="Across all accounts" />
        <StatCard icon={Users} tone="cyan" label="Accounts" value={s?.total_accounts} format={(v) => Math.round(v).toLocaleString()} sub={s ? `${s.transactions.total.toLocaleString()} transactions posted` : undefined} />
        <StatCard icon={ArrowDownLeft} tone="emerald" label="Credits" value={s?.transactions.credit_volume} format={money} sub={s ? `${s.transactions.credit_count} credit entries` : undefined} />
        <StatCard icon={ArrowUpRight} tone="rose" label="Debits" value={s?.transactions.debit_volume} format={money} sub={s ? `${s.transactions.debit_count} debit entries` : undefined} />
      </motion.section>

      <section className="grid gap-6 lg:grid-cols-5">
        {/* Accounts */}
        <div className="lg:col-span-3">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-xl font-semibold text-white">
              Accounts
              {accounts.data && <span className="ml-2 text-sm font-normal text-slate-500">{accounts.data.pagination.total_records}</span>}
            </h2>
            <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 transition-colors focus-within:border-indigo-400/60 sm:w-64">
              <Search className="size-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or ID"
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
              />
            </div>
          </div>

          {accounts.loading && !accounts.data ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[138px] rounded-2xl" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <Card>
              <EmptyState
                icon={Users}
                title="No accounts yet"
                description="Create your first account to start recording transactions."
                action={
                  <Button icon={Plus} onClick={() => openModal('create-account')}>
                    New account
                  </Button>
                }
              />
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState icon={Search} title="No matches" description={`No account matches “${query}”.`} />
            </Card>
          ) : (
            <motion.div key={query ? 'filtered' : 'all'} variants={container} initial={entranceInitial()} animate="show" className="grid gap-4 sm:grid-cols-2">
              {filtered.map((a) => (
                <AccountCard key={a.id} account={a} />
              ))}
            </motion.div>
          )}
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 font-display text-xl font-semibold text-white">Recent activity</h2>
          <Card className="p-2">
            {stats.loading && !s ? (
              <TransactionListSkeleton rows={5} />
            ) : s?.recent_transactions.length ? (
              <TransactionList transactions={s.recent_transactions} showAccount accountNames={names} listKey="recent" />
            ) : (
              <EmptyState icon={Activity} title="No activity yet" description="Transactions across all accounts will show up here." />
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
