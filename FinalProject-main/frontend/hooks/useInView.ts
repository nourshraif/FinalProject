"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Returns isInView when element is at least 20% visible.
 * Once triggered, stays true (no re-hiding).
 */
export function useInView(threshold = 0.2): [boolean, React.RefObject<HTMLElement | null>] {
  const ref = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsInView(true);
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [isInView, ref];
}
