import { useEffect, useState } from "react";

/**
 * A clock that actually advances.
 *
 * Any screen whose whole promise is "what is happening now" has to recompute
 * from a moving `now`, or it silently freezes at the moment it mounted and goes
 * on confidently reporting a stale day. A tab left open over midnight is the
 * common case, not the edge one.
 *
 * Thirty seconds by default: fine enough that "in 25 min" is never wrong by
 * more than half a minute, coarse enough that it costs nothing.
 */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
