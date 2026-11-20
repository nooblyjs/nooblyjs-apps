// NooblyJS Phase 27 / D10: the mock and echo providers are test doubles. They leave the public API (src/index.js) for
// the testing entry, echo is not offered, and echo is refused when NODE_ENV=production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as harness from '../src/index.js';
import * as testing from '../testing.js';
import { chooseProvider, createProvider, OFFERED } from '../src/providers/index.js';

test('the public API exports no mock or echo provider; the testing entry does', () => {
  assert.equal('createMockProvider' in harness, false);
  assert.equal('createEchoProvider' in harness, false);
  assert.equal(typeof testing.createMockProvider, 'function');
  assert.equal(typeof testing.createEchoProvider, 'function');
});

test('echo is not in the list a person picks from', () => {
  assert.ok(!OFFERED.includes('echo'));
  assert.ok(OFFERED.includes('anthropic'));
  assert.throws(() => chooseProvider({ requested: 'nope', env: {} }), (err) => !/echo/.test(err.message));
});

test('echo still works in development, and is refused in production', () => {
  assert.deepEqual(chooseProvider({ requested: 'echo', env: {} }), { id: 'echo' });
  assert.throws(() => chooseProvider({ requested: 'echo', env: { NODE_ENV: 'production' } }), /refused when NODE_ENV=production/);
  assert.throws(() => createProvider('echo', { env: { NODE_ENV: 'production' } }), /refused when NODE_ENV=production/);
});
