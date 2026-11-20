// Infra spec 8.9.2 through hero-co: the infrastructure accelerator registers its agent endpoint with host.onUpgrade,
// and hero-co's server passes WebSocket upgrades through, so a local server's agent reaches it on hero-co's own port.
// An agent with a credential the controller never issued is refused and stops; any other upgrade path is a 404.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectForever } from 'nooblyjs-accelerator-infrastructure/agent/connect';
import { createMockDocker } from 'nooblyjs-accelerator-infrastructure/agent/docker-mock';
import { startApp } from './helpers.js';

test('a local server\'s agent reaches the accelerator through hero-co\'s port; an unknown credential is refused', async () => {
  const app = await startApp();
  try {
    const agent = connectForever({
      controller: app.base, identity: () => ({ server: 'srv_abcdefgh12', credential: 'x'.repeat(43) }), docker: createMockDocker(),
      facts: async () => ({}), log: { info() {}, warn() {} },
    });
    assert.deepEqual(await agent.done, { reason: 'Unknown server or credential.' });

    const ws = new WebSocket(`${app.base.replace('http', 'ws')}/elsewhere`);
    assert.ok(await new Promise((r) => { ws.addEventListener('error', () => r(true)); ws.addEventListener('open', () => r(false)); }), 'other paths are not upgraded');
  } finally {
    await app.close();
  }
});
