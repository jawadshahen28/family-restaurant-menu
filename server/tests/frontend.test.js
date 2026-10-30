import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { serveFrontend } from '../src/frontend.js';

let directory, app;
before(() => {
  fs.mkdirSync(path.resolve('.cache'), { recursive: true });
  directory = fs.mkdtempSync(path.resolve('.cache/frontend-test-'));
  fs.mkdirSync(path.join(directory, 'assets'));
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html><div id="root">Test SPA</div>');
  fs.writeFileSync(path.join(directory, 'assets', 'test.js'), 'console.log("test asset")');
  fs.writeFileSync(path.join(directory, 'sw.js'), '// test service worker');
  app = express();
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  serveFrontend(app, directory);
  app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
});
after(() => {
  const cache = path.resolve('.cache') + path.sep;
  assert.ok(directory.startsWith(cache), 'Only remove the test directory inside the workspace cache');
  fs.rmSync(directory, { recursive: true, force: true });
});

test('same-origin hosting serves customer and admin deep links without caching the HTML', async () => {
  for (const route of ['/', '/admin/login', '/admin/categories', '/checkout', '/order-success/test']) {
    const response = await request(app).get(route).set('Accept', 'text/html');
    assert.equal(response.status, 200);
    assert.match(response.text, /Test SPA/);
    assert.match(response.headers['cache-control'], /no-store/);
  }
});

test('static assets work while API, uploads, missing files and non-navigation requests never return the SPA', async () => {
  assert.equal((await request(app).get('/api/health')).body.status, 'ok');
  const asset = await request(app).get('/assets/test.js');
  assert.equal(asset.status, 200);
  assert.match(asset.headers['cache-control'], /immutable/);
  assert.match((await request(app).get('/sw.js')).headers['cache-control'], /no-cache/);
  for (const route of ['/api', '/api/admin/missing', '/uploads', '/uploads/missing.png', '/assets/missing.js', '/src/App.jsx']) {
    const response = await request(app).get(route).set('Accept', 'text/html');
    assert.equal(response.status, 404, route);
    assert.equal(response.body.error, 'NOT_FOUND');
  }
  assert.equal((await request(app).post('/checkout')).status, 404);
  assert.equal((await request(app).get('/admin').set('Accept', 'application/json')).status, 404);
});

test('unified hosting fails clearly when the frontend has not been built', () => {
  assert.throws(() => serveFrontend(express(), path.join(directory, 'missing')), /Frontend build missing/);
});
