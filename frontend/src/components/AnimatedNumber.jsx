import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

/** Counts smoothly from the previous value to the new one. */
export default function AnimatedNumber({ value, format = (v) => v.toFixed(0), duration = 0.9, className }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value ?? 0);
  const prev = useRef(0);

  useEffect(() => {
    const to = Number(value) || 0;
    if (reduce) {
      setDisplay(to);
      prev.current = to;
      return undefined;
    }
    const controls = animate(prev.current, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDisplay,
    });
    prev.current = to;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <span className={`tabular-nums ${className ?? ''}`}>{format(display)}</span>;
}
