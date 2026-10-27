import { forwardRef } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, LoaderCircle } from 'lucide-react';
import { useCopy } from '../lib/hooks';

const cx = (...classes) => classes.filter(Boolean).join(' ');
export { cx };

const BUTTON_VARIANTS = {
  primary:
    'text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40',
  secondary: 'text-slate-100 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] hover:border-white/20',
  ghost: 'text-slate-300 hover:text-white hover:bg-white/[0.06]',
  credit: 'text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25',
  debit: 'text-white bg-gradient-to-r from-rose-500 to-orange-500 shadow-lg shadow-rose-500/25',
};

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, disabled, ...props }) {
  const sizes = { sm: 'h-9 px-3.5 text-sm gap-1.5', md: 'h-11 px-5 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };
  return (
    <motion.button
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cx(
        'relative inline-flex select-none items-center whitespace-nowrap justify-center rounded-xl font-medium transition-[background,box-shadow,border-color,color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </motion.button>
  );
}

export const Input = forwardRef(function Input({ className, invalid, prefix, suffix, ...props }, ref) {
  return (
    <div
      className={cx(
        'group flex h-12 items-center rounded-xl border bg-white/[0.03] transition-colors duration-200 focus-within:bg-white/[0.05]',
        invalid
          ? 'border-rose-500/60 focus-within:border-rose-400'
          : 'border-white/10 hover:border-white/20 focus-within:border-indigo-400/70',
        className,
      )}
    >
      {prefix && <span className="pl-4 text-slate-400">{prefix}</span>}
      <input
        ref={ref}
        className="h-full w-full min-w-0 bg-transparent px-4 text-[15px] text-white placeholder:text-slate-500 outline-none"
        aria-invalid={invalid || undefined}
        {...props}
      />
      {suffix && <span className="pr-2">{suffix}</span>}
    </div>
  );
});

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-300">{label}</span>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </span>
      {children}
      <motion.span
        initial={false}
        animate={{ height: error ? 'auto' : 0, opacity: error ? 1 : 0 }}
        className="block overflow-clip text-xs text-rose-400"
      >
        <span className="block pt-1.5">{error}</span>
      </motion.span>
    </label>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('glass rounded-2xl', className)} {...props}>
      {children}
    </div>
  );
}

export function TypeBadge({ type }) {
  const credit = type === 'credit';
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        credit ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20' : 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20',
      )}
    >
      {type}
    </span>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('shimmer rounded-lg', className)} />;
}

export function CopyButton({ text, className, label = 'Copy' }) {
  const [copied, copy] = useCopy();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        copy(text);
      }}
      className={cx(
        'inline-flex items-center gap-1 rounded-md p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200',
        className,
      )}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied!' : label}
    >
      {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/** Pill-style tabs with a sliding active indicator (shared layout animation). */
export function SegmentedControl({ options, value, onChange, layoutId, className }) {
  return (
    <div className={cx('relative inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1', className)} role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value ?? 'all'}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cx(
              'relative z-10 flex-1 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-200',
              active ? 'text-white' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className={cx('absolute inset-0 -z-10 rounded-lg', opt.activeClass ?? 'bg-white/10 ring-1 ring-white/15')}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="inline-flex items-center gap-1.5">
              {opt.icon && <opt.icon className="size-3.5" />}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-indigo-500/30 blur-xl" />
        <div className="relative grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <Icon className="size-6 text-indigo-300" />
        </div>
      </div>
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      <span>
        <span className="font-semibold">{error.code ?? 'Error'}:</span> {error.message}
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-medium text-rose-100 underline-offset-4 hover:underline">
          Retry
        </button>
      )}
    </motion.div>
  );
}
