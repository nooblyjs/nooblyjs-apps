// A bad start mounts nothing (roadmap 0.3): a missing host capability is found before any accelerator is mounted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import express from 'express';
import { mountAccelerators } from '../src/platform/accelerators.js';
import { loadConfig } from '../src/config.js';
import { listen, caller, tempDir } from './helpers.js';

const require = createRequire(import.meta.url);

test('a host without a frame is refused and neither accelerator is mounted', async () => {
  const app = express();
  const serviceRegistry = require('nooblyjs-core');
  const eventEmitter = new EventEmitter();
  serviceRegistry.initialize(app, eventEmitter, { security: { apiKeyAuth: { requireApiKey: false, apiKeys: [] } } });
  const dataDir = await tempDir();
  const pass = (req, res, next) => next();
  const host = { express, auth: pass, requireRole: () => pass, can: async () => true, audit: pass, events: { emit: async () => {} }, store: {}, people: {}, service: () => null };
  const shell = { add() { throw new Error('nothing should reach the shell'); } };

  await assert.rejects(
    mountAccelerators({ app, eventEmitter, serviceRegistry, infraHost: host, shell, dataDir, config: { ...loadConfig({}), dataDir } }),
    /missing frame; nothing was mounted/,
  );
  await assert.rejects(
    mountAccelerators({ app, eventEmitter: null, serviceRegistry, infraHost: { ...host, frame: pass }, shell, dataDir, config: loadConfig({}) }),
    /EventEmitter/,
  );

  app.use((req, res) => res.status(404).type('text').send('fallback'));
  const { server, base } = await listen(app);
  try {
    const get = caller(base);
    assert.equal((await get('GET', '/admin/customer/api/v1/health')).text, 'fallback');
    assert.equal((await get('GET', '/infrastructure/api/v1/about')).text, 'fallback');
  } finally {
    server.close();
    await serviceRegistry.shutdown?.();
  }
});

test('in production the app refuses the development sign-in and needs SESSION_SECRET', async () => {
  const { createApp } = await import('../src/app.js');
  assert.equal(loadConfig({ NODE_ENV: 'production' }).devSignIn, false, 'never on by default in production');
  await assert.rejects(createApp({ config: { ...loadConfig({ NODE_ENV: 'production' }), devSignIn: true, sessionSecret: 's' } }), /development sign-in/);
  await assert.rejects(createApp({ config: loadConfig({ NODE_ENV: 'production' }) }), /SESSION_SECRET/);
});
