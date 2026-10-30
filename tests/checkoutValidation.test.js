import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, validateCheckout } from '../src/utils/checkoutValidation.js';

const pickup = { name: 'أحمد عبد الهادي', phone: '0599123456', fulfillmentType: 'pickup', notes: '' };

test('customer name and phone are required with field-specific Arabic messages', () => {
  const { errors } = validateCheckout({ ...pickup, name: '  ', phone: '' });
  assert.match(errors.name, /اسم/);
  assert.match(errors.phone, /هاتف/);
});

test('phone validation accepts local, international, spaced and Arabic digit formats', () => {
  for (const phone of ['0599123456', '0599 123 456', '0599-123-456', '٠٥٩٩١٢٣٤٥٦', '۰۵۹۹۱۲۳۴۵۶', '+970599123456', '+972599123456', '00970599123456', '00972599123456', '970599123456', '+970 (0) 599 123 456', '599123456']) {
    assert.equal(normalizePhone(phone), '0599123456', phone);
  }
  assert.equal(normalizePhone('0568123456'), '0568123456');
  assert.equal(normalizePhone('0541234567'), '0541234567');
  assert.equal(normalizePhone('092345678'), '092345678');
  assert.equal(normalizePhone('+970 2 234 5678'), '022345678');
});

test('phone validation rejects incomplete, malformed or unrelated international numbers', () => {
  for (const phone of ['0599', 'abc0599123456', '+1 202 555 0123', '05991234567890', '++970599123456', '0000000000', '0599/123456']) {
    assert.equal(normalizePhone(phone), '', phone);
    assert.ok(validateCheckout({ ...pickup, phone }).errors.phone);
  }
});

test('pickup needs no address and removes a previously entered delivery address', () => {
  const result = validateCheckout({ ...pickup, name: '  أحمد  ', deliveryAddress: 'نابلس، شارع الجامعة', notes: ' الصوص على جنب ' });
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.deliveryAddress, null);
  assert.equal(result.values.name, 'أحمد');
  assert.equal(result.values.notes, 'الصوص على جنب');
});

test('delivery requires a useful address; optional notes and Arabic names remain flexible', () => {
  assert.ok(validateCheckout({ ...pickup, fulfillmentType: 'delivery' }).errors.deliveryAddress);
  assert.ok(validateCheckout({ ...pickup, fulfillmentType: 'delivery', deliveryAddress: '  ' }).errors.deliveryAddress);
  for (const name of ['أم أحمد', 'عبد الرّحمن أبو عيشة', 'Anne-Marie', 'محمد أحمد علي']) {
    assert.deepEqual(validateCheckout({ ...pickup, name, fulfillmentType: 'delivery', deliveryAddress: 'نابلس، شارع الجامعة، بجانب المكتبة' }).errors, {});
  }
  assert.ok(validateCheckout({ ...pickup, fulfillmentType: 'table' }).errors.fulfillmentType);
});
