"use client";

/**
 * reading progress ... a thin golden line at the very top of the published
 * piece that fills as you move down the page. quiet, no numbers, just a sense
 * of how far in you are. scales on the gpu (transform), passive scroll.
 */

import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setPct(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return <div className="np-read-progress" aria-hidden style={{ transform: `scaleX(${pct})` }} />;
}
