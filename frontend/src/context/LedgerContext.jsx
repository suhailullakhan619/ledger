import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const LedgerContext = createContext(null);

/**
 * Holds a data `version` that every page includes in its fetch dependencies.
 * Mutations call `refresh()` so all visible data (stats, lists, balances) reloads.
 * Also owns which modal is open, so any page can open "New transaction" etc.
 */
export function LedgerProvider({ children }) {
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState(null); // { name, props }

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const openModal = useCallback((name, props = {}) => setModal({ name, props }), []);
  const closeModal = useCallback(() => setModal(null), []);

  const value = useMemo(
    () => ({ version, refresh, modal, openModal, closeModal }),
    [version, refresh, modal, openModal, closeModal],
  );
  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used inside <LedgerProvider>');
  return ctx;
}
