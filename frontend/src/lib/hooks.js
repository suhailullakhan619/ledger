import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * `initial` value for staggered entrance variants. When the document is hidden the
 * browser pauses animation frames, so the stagger would never start and the content
 * would stay invisible; mount it directly in its final state instead.
 */
export function entranceInitial(variant = 'hidden') {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden' ? false : variant;
}

/**
 * Run an async loader whenever `deps` change. Keeps the previous data while
 * reloading so the UI does not flash back to skeletons on every refresh.
 */
export function useApi(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loaderRef
      .current()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState((s) => ({ data: s.data, error, loading: false })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export function useCopy(timeout = 1400) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), timeout);
      } catch {
        setCopied(false);
      }
    },
    [timeout],
  );
  return [copied, copy];
}
