import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeftRight, Landmark, LoaderCircle, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useLedger } from '../context/LedgerContext';
import { Button, cx } from './ui';

function Aurora() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-clip" aria-hidden="true">
      <div className="grid-overlay absolute inset-0" />
      <div className="aurora-blob left-[-10%] top-[-15%] h-[45vw] w-[45vw] bg-indigo-600" style={{ animation: 'drift-a 22s ease-in-out infinite' }} />
      <div className="aurora-blob right-[-12%] top-[5%] h-[38vw] w-[38vw] bg-fuchsia-600/80" style={{ animation: 'drift-b 26s ease-in-out infinite' }} />
      <div className="aurora-blob bottom-[-20%] left-[25%] h-[40vw] w-[40vw] bg-cyan-500/60" style={{ animation: 'drift-c 30s ease-in-out infinite' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-950/40 to-ink-950" />
    </div>
  );
}

/**
 * Polls /health. `slow` turns true when the API has not answered within a few
 * seconds, which on free hosting (e.g. Render) usually means it is waking from sleep.
 */
function useApiStatus() {
  const [status, setStatus] = useState('checking');
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer;
    const check = () =>
      api
        .health()
        .then(
          () => 'online',
          () => 'offline',
        )
        .then((next) => {
          if (!alive) return;
          setStatus(next);
          // Poll quickly until the API is up, then relax.
          timer = setTimeout(check, next === 'online' ? 15000 : 4000);
        });
    const slowTimer = setTimeout(() => alive && setSlow(true), 4000);
    check();
    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(slowTimer);
    };
  }, []);

  return { status, waking: slow && status !== 'online' };
}

function ApiStatus({ status }) {
  const styles = {
    checking: ['bg-amber-400', 'Connecting'],
    online: ['bg-emerald-400', 'API online'],
    offline: ['bg-rose-500', 'API offline'],
  }[status];

  return (
    <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 sm:flex">
      <span className="relative flex size-2">
        {status === 'online' && <span className={cx('absolute inline-flex size-full animate-ping rounded-full opacity-60', styles[0])} />}
        <span className={cx('relative inline-flex size-2 rounded-full', styles[0])} />
      </span>
      {styles[1]}
    </div>
  );
}

export default function Layout({ children }) {
  const { openModal, refresh } = useLedger();
  const location = useLocation();
  const { status, waking } = useApiStatus();

  // When the API comes back (e.g. after waking from sleep), reload page data that may have failed.
  const wasDown = useRef(false);
  useEffect(() => {
    if (status === 'online' && wasDown.current) refresh();
    wasDown.current = status === 'offline' || waking;
  }, [status, waking, refresh]);

  // BrowserRouter keeps the previous scroll offset; start each page at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen">
      <Aurora />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <motion.div
              whileHover={{ rotate: -8, scale: 1.06 }}
              className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 shadow-lg shadow-indigo-500/30"
            >
              <Landmark className="size-[18px] text-white" />
            </motion.div>
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              Ledger<span className="text-gradient">.</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cx('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', isActive ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white')
              }
            >
              Dashboard
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ApiStatus status={status} />
            <Button variant="secondary" size="sm" icon={ArrowLeftRight} onClick={() => openModal('transfer')} className="hidden sm:inline-flex">
              Transfer
            </Button>
            <Button size="sm" icon={Plus} onClick={() => openModal('create-account')}>
              <span className="hidden sm:inline">New account</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {waking && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-clip border-b border-amber-400/20 bg-amber-400/10"
            role="status"
          >
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-sm text-amber-100 sm:px-6">
              <LoaderCircle className="size-4 shrink-0 animate-spin text-amber-300" />
              <span>
                Waking up the API server. Free hosting sleeps when idle, so the first request can take up to a minute.
                Data will load automatically.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entrance-only page transition. No exit / mode="wait": a stalled exit
          animation would leave the page blank after navigating. */}
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 sm:pt-10"
      >
        {children}
      </motion.main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-center text-xs text-slate-500 sm:px-6">
        Transaction Ledger · Express + MongoDB API · React frontend
      </footer>
    </div>
  );
}
