type Tick = (dt: number) => void;

const ticks = new Set<Tick>();
let frame = 0;
let last = 0;

function run(now: number): void {
  // Clamp so a tab coming back from the background does not get one giant step.
  const dt = Math.min(Math.max((now - last) / 1000, 0), 1 / 20);
  last = now;
  for (const tick of ticks) tick(dt);
  frame = ticks.size > 0 ? requestAnimationFrame(run) : 0;
}

/**
 * One requestAnimationFrame loop shared by every buddy on the page.
 * It stops when nobody is subscribed, and browsers pause it in hidden tabs.
 */
export function subscribe(tick: Tick): () => void {
  ticks.add(tick);
  if (!frame && typeof requestAnimationFrame !== 'undefined') {
    last = performance.now();
    frame = requestAnimationFrame(run);
  }
  return () => {
    ticks.delete(tick);
    if (ticks.size === 0 && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

export const activeSubscribers = (): number => ticks.size;
