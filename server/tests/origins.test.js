import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllowedOrigins, safeOriginForLog } from '../src/config/origins.js';

const interfaces = { wifi: [{ address: '192.168.42.20', internal: false }, { address: 'fd12::20', internal: false }], vpn: [{ address: '10.8.0.20', internal: false }], public: [{ address: '203.0.113.20', internal: false }], loopback: [{ address: '127.0.0.1', internal: true }] };
const development = (overrides = {}) => buildAllowedOrigins({ clientOrigin: 'http://localhost:5173', nodeEnv: 'development', interfaces, ...overrides });

test('development supports localhost aliases and the actual Vite fallback port', () => {
  const allowed = development();
  for (const host of ['localhost', '127.0.0.1', '[::1]']) for (const port of [5173, 5174]) assert.ok(allowed.includes(`http://${host}:${port}`));
  assert.equal(allowed.includes('http://localhost:5000'), false);
});

test('LAN auto-discovery allows only this computer private interfaces on configured ports', () => {
  const allowed = development();
  for (const host of ['192.168.42.20', '10.8.0.20', '[fd12::20]']) assert.ok(allowed.includes(`http://${host}:5174`));
  for (const origin of ['http://192.168.42.99:5174', 'http://203.0.113.20:5174', 'http://192.168.42.20:9999', 'https://untrusted.example', 'null']) assert.equal(allowed.includes(origin), false);
});

test('development ports and exact local origins are configurable without one hardcoded LAN IP', () => {
  const allowed = development({ devClientPorts: '5180,5181', devClientOrigins: 'http://menu.local:5182,http://172.20.1.5:5183' });
  assert.ok(allowed.includes('http://192.168.42.20:5180'));
  assert.ok(allowed.includes('http://menu.local:5182'));
  assert.ok(allowed.includes('http://172.20.1.5:5183'));
  assert.equal(allowed.includes('http://192.168.42.20:5174'), false);
});

test('automatic LAN discovery can be disabled while preserving explicit local origins', () => {
  const allowed = development({ devAllowLan: false, devClientOrigins: 'http://192.168.42.20:5174' });
  assert.ok(allowed.includes('http://192.168.42.20:5174'));
  assert.equal(allowed.includes('http://10.8.0.20:5174'), false);
});

test('production ignores all development ports, interfaces and supplementary origins', () => {
  const allowed = buildAllowedOrigins({ clientOrigin: 'https://menu.example.com', nodeEnv: 'production', devClientPorts: '5173,5174', devClientOrigins: 'http://menu.local:5174', devAllowLan: true, interfaces });
  assert.deepEqual(allowed, ['https://menu.example.com']);
  assert.throws(() => buildAllowedOrigins({ clientOrigin: 'http://menu.example.com', nodeEnv: 'production' }));
});

test('wildcards, public development additions, credentials, paths and invalid ports are rejected', () => {
  for (const value of ['*', 'null', 'http://localhost:5174/path', 'http://user:secret@localhost:5174', 'http://localhost:5174?x=1', 'http://localhost:5174#fragment']) assert.throws(() => development({ clientOrigin: value }));
  for (const value of ['*', 'https://untrusted.example', 'http://menu.local:5174/']) assert.throws(() => development({ devClientOrigins: value }));
  for (const value of ['', '0', '65536', '5173-5180', 'bad']) assert.throws(() => development({ devClientPorts: value }));
});

test('rejected-origin diagnostics never log userinfo or invalid origin contents', () => {
  assert.equal(safeOriginForLog('http://localhost:5174'), 'http://localhost:5174');
  assert.equal(safeOriginForLog('http://user:secret@localhost:5174'), '[invalid origin]');
  assert.equal(safeOriginForLog('null'), '[invalid origin]');
});
