import { useEffect, useState } from 'react';

/** A fake microphone level: speech-like bursts, 0–1. */
export function useFakeLevel(enabled: boolean): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setLevel(0);
      return;
    }
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      const t = (now - start) / 1000;
      const phrase = Math.max(0, Math.sin(t * 1.3) + Math.sin(t * 0.7 + 1) * 0.6);
      const syllable = 0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 6.3);
      setLevel(Math.min(1, phrase * syllable * 0.9));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
  return level;
}

/** Steps through a script, one entry every `ms`. */
export function useScript<T>(script: readonly T[], ms: number, offset = 0): T {
  const [i, setI] = useState(offset % script.length);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % script.length), ms);
    return () => clearInterval(id);
  }, [script.length, ms]);
  return script[i];
}
