// Injectable clock. Production uses the system clock; tests pass a fake one
// to simulate T+1h, T+24h… without waiting. Only the server's clock is ever
// trusted for expiry decisions (never the visitor's device).
export const systemClock = { now: () => Date.now() };

/** A controllable clock for tests: start at `startMs`, move with advance(ms) / set(ms). */
export function fakeClock(startMs = Date.UTC(2026, 9, 3, 7, 0, 0)) {
  let t = startMs;
  return { now: () => t, advance: (ms) => { t += ms; return t; }, set: (ms) => { t = ms; return t; } };
}

export const HOUR = 3600 * 1000;
export const iso = (ms) => new Date(ms).toISOString();
