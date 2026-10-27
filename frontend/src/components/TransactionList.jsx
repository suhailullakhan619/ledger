import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { formatDateTime, formatMoney, shortId, timeAgo } from '../lib/format';
import { CopyButton, Skeleton, cx } from './ui';

export function TransactionRow({ txn, index = 0, showAccount = false, accountName }) {
  const credit = txn.type === 'credit';
  const Icon = credit ? ArrowDownLeft : ArrowUpRight;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.035, duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
      className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.03] sm:px-4"
    >
      <div
        className={cx(
          'grid size-10 shrink-0 place-items-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110',
          credit ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20' : 'bg-rose-500/10 text-rose-300 ring-rose-500/20',
        )}
      >
        <Icon className="size-[18px]" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-slate-100">{txn.description || (credit ? 'Credit' : 'Debit')}</p>
          {txn.transfer_id && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300 ring-1 ring-sky-500/20">
              <ArrowLeftRight className="size-3" /> Transfer
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-0.5 font-mono text-slate-400">
            {txn.reference_id}
            <CopyButton text={txn.reference_id} label="Copy reference" className="opacity-0 group-hover:opacity-100" />
          </span>
          {showAccount && (
            <>
              <span className="text-slate-600">•</span>
              <Link to={`/accounts/${txn.account_id}`} className="text-slate-400 hover:text-indigo-300">
                {accountName ?? shortId(txn.account_id)}
              </Link>
            </>
          )}
          <span className="text-slate-600">•</span>
          <time dateTime={txn.created_at} title={formatDateTime(txn.created_at)}>
            {timeAgo(txn.created_at)}
          </time>
        </div>
      </div>

      <p className={cx('shrink-0 text-right font-display text-[15px] font-semibold tabular-nums', credit ? 'text-emerald-300' : 'text-rose-300')}>
        {credit ? '+' : '−'}
        {formatMoney(txn.amount)}
      </p>
    </motion.li>
  );
}

export function TransactionListSkeleton({ rows = 5 }) {
  return (
    <ul className="space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-4 px-3 py-3 sm:px-4">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-20" />
        </li>
      ))}
    </ul>
  );
}

export default function TransactionList({ transactions, showAccount, accountNames = {}, listKey }) {
  return (
    <ul className="space-y-0.5">
      <AnimatePresence mode="popLayout" initial={false}>
        {transactions.map((txn, i) => (
          <TransactionRow
            key={`${listKey ?? ''}-${txn.id}`}
            txn={txn}
            index={i}
            showAccount={showAccount}
            accountName={accountNames[txn.account_id]}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}
