/**
 * Runs `run` for the newest wanted value, one round at a time, and never throws a round away because a newer value
 * arrived: the next round starts with the newest one, those in between are skipped. A delay that every new value
 * restarts (a debounce) cannot do this - a value that changes faster than the delay keeps it from running at all,
 * and the result only shows when the changes stop (#516: the filled cut face of the section view lagged behind the
 * plane for as long as it was moved).
 */
export type LatestRunner<T> = {
  /** Asks for a round with `value`; the newest request wins. */
  request: (value: T) => void;
  /** Forgets what is wanted: no round starts any more, and a round in flight can see that through `wanted()`. */
  clear: () => void;
  /** What is wanted now, or null - for a round in flight to check that its result is still wanted. */
  wanted: () => T | null;
};

export function createLatestRunner<T>(
  run: (value: T) => Promise<void>,
  same: (a: T, b: T) => boolean,
  /** Starts `fn` later and returns what cancels it; a timeout of 0 by default. */
  schedule: (fn: () => void) => () => void = (fn) => {
    const id = setTimeout(fn, 0);
    return () => clearTimeout(id);
  },
): LatestRunner<T> {
  let wanted: T | null = null;
  let busy = false;
  let cancelStart: (() => void) | null = null;

  const planStart = () => {
    if (cancelStart !== null || busy || wanted === null) return;
    cancelStart = schedule(() => {
      cancelStart = null;
      void start();
    });
  };

  const start = async () => {
    if (busy || wanted === null) return;
    const mine = wanted;
    busy = true;
    try {
      await run(mine);
    } catch {
      // A failed round is not retried by itself; the next request starts a new one.
    } finally {
      busy = false;
      if (wanted !== null && !same(wanted, mine)) planStart();
    }
  };

  return {
    request(value) {
      wanted = value;
      planStart();
    },
    clear() {
      wanted = null;
      if (cancelStart !== null) {
        cancelStart();
        cancelStart = null;
      }
    },
    wanted: () => wanted,
  };
}
