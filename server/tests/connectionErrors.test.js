import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionFailure } from '../src/config/connectionErrors.js';

test('classifies missing and timed-out DNS separately from server network reachability', () => {
  for (const code of ['ENOTFOUND', 'ETIMEOUT', 'ECONNREFUSED']) {
    const result = connectionFailure(Object.assign(new Error(`querySrv ${code} _mongodb._tcp.cluster.example.mongodb.net`), { code, syscall: 'querySrv' }));
    assert.equal(result.category, 'DNS');
    assert.equal(result.diagnostics[0].code, code);
  }
  assert.equal(connectionFailure(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' })).category, 'NETWORK');
});

test('distinguishes authentication, database permissions, TLS and configuration errors', () => {
  assert.equal(connectionFailure(Object.assign(new Error('bad auth : authentication failed'), { code: 8000 })).category, 'AUTHENTICATION');
  assert.equal(connectionFailure(Object.assign(new Error('Authentication failed'), { code: 18 })).category, 'AUTHENTICATION');
  assert.equal(connectionFailure(Object.assign(new Error('not authorized on family_menu'), { code: 13 })).category, 'AUTHORIZATION');
  assert.equal(connectionFailure(new Error('certificate has expired')).category, 'TLS');
  assert.equal(connectionFailure(Object.assign(new Error('invalid URI'), { name: 'MongoParseError' })).category, 'CONFIGURATION');
});

test('nested topology errors preserve precise safe network evidence', () => {
  const nested = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
  const error = Object.assign(new Error('Server selection timed out'), { name: 'MongooseServerSelectionError', reason: { servers: new Map([['node', { error: nested }]]) } });
  const result = connectionFailure(error);
  assert.equal(result.category, 'NETWORK');
  assert.ok(result.diagnostics.some((entry) => entry.code === 'ECONNREFUSED'));
});

test('diagnostics redact the complete URI and both encoded and decoded passwords', () => {
  const uri = 'mongodb+srv://family_menu:private%40secret@cluster.example.mongodb.net/family_menu';
  const result = connectionFailure(new Error(`Failed URI ${uri}; private@secret private%40secret`), uri);
  const output = JSON.stringify(result.diagnostics);
  assert.equal(output.includes(uri), false);
  assert.equal(output.includes('private@secret'), false);
  assert.equal(output.includes('private%40secret'), false);
  assert.match(output, /redacted/);
});
