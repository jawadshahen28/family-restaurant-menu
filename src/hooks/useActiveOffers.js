import { useEffect, useState } from 'react';
import { getActiveOffers } from '../utils/offers';

export default function useActiveOffers(offers, serverTimeOffset = 0) {
  const [now, setNow] = useState(() => Date.now() + serverTimeOffset);
  useEffect(() => {
    setNow(Date.now() + serverTimeOffset);
  }, [offers, serverTimeOffset]);
  useEffect(() => {
    const boundaries = offers.filter((offer) => offer.isActive).flatMap((offer) => [Date.parse(offer.startDate), Date.parse(offer.endDate) + 1]).filter((time) => Number.isFinite(time) && time > now);
    const nextBoundary = boundaries.length ? Math.min(...boundaries) : null;
    const refresh = () => setNow(Date.now() + serverTimeOffset);
    const timeout = nextBoundary === null ? null : window.setTimeout(refresh, Math.min(Math.max(1, nextBoundary - Date.now() - serverTimeOffset), 2147483647));
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearTimeout(timeout); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [now, offers, serverTimeOffset]);
  return getActiveOffers(offers, now);
}
