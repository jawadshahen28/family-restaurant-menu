import test from 'node:test';
import assert from 'node:assert/strict';
import { getActiveOffers } from '../src/utils/offers.js';

const offer = { id: 'offer', isActive: true, startDate: '2026-10-30T12:00:00+02:00', endDate: '2026-10-30T14:00:00+02:00' };
test('offers require activity and a valid current date interval', () => {
  const now = '2026-10-30T11:00:00Z';
  assert.equal(getActiveOffers([offer], now).length, 1);
  assert.deepEqual(getActiveOffers([{ ...offer, isActive: false }], now), []);
  assert.deepEqual(getActiveOffers([offer], '2026-10-30T09:59:59Z'), []);
  assert.deepEqual(getActiveOffers([offer], '2026-10-30T12:00:01Z'), []);
  assert.deepEqual(getActiveOffers([{ ...offer, endDate: 'invalid' }], now), []);
  assert.deepEqual(getActiveOffers([{ ...offer, startDate: offer.endDate, endDate: offer.startDate }], now), []);
  assert.deepEqual(getActiveOffers([], now), []);
});
test('start and end boundaries are inclusive and respect timezone offsets', () => {
  assert.equal(getActiveOffers([offer], '2026-10-30T10:00:00Z').length, 1);
  assert.equal(getActiveOffers([offer], '2026-10-30T12:00:00Z').length, 1);
});
