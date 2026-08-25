import { useEffect, useState } from "react";

export default function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }
    const duration = 500;
    const startedAt = window.performance.now();
    let frame = 0;
    setDisplayValue(0);

    function tick(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      setDisplayValue(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{displayValue}</>;
}
