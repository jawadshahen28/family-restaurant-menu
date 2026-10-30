export function getActiveOffers(offers, now = Date.now()) {
  const currentTime = new Date(now).getTime();
  return offers.filter((offer) => {
    const start = Date.parse(offer.startDate);
    const end = Date.parse(offer.endDate);
    return offer.isActive === true && Number.isFinite(start) && Number.isFinite(end)
      && start <= currentTime && currentTime <= end;
  });
}
