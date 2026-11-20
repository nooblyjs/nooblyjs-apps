// NooblyJS Phase 27 (no mocks in production): a production Factory never plays a scripted model. A work item's
// script, `factory agent --script`, `factory init --script` and the bench's oracle and null agents are all refused.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scriptedProvider, loadScriptedProvider, refuseScriptInProduction } from '../../../src/services/exec/harness/script.js';
import { providerFor } from '../../../src/services/line/stations/common.js';
import { modelConfigured } from '../../../src/services/intake/handoff.js';
import * as factory from '../../../index.js';

const saved = process.env.NODE_ENV;
afterEach(() => { if (saved === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved; });

const scriptFile = () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'script-')), 'build.json');
  fs.writeFileSync(file, JSON.stringify([{ text: 'Done.' }]));
  return file;
};

test('outside production a script still plays (offline demos and tests)', () => {
  delete process.env.NODE_ENV;
  assert.equal(typeof scriptedProvider([{ text: 'Done.' }]), 'object');
  assert.equal(typeof loadScriptedProvider(scriptFile()), 'object');
});

test('in production a scripted model is refused, with a reason a person can read', () => {
  process.env.NODE_ENV = 'production';
  assert.throws(() => scriptedProvider([{ text: 'Done.' }]), /refused when NODE_ENV=production/);
  assert.throws(() => loadScriptedProvider(scriptFile()), /refused when NODE_ENV=production/);
  assert.throws(() => refuseScriptInProduction("The bench's oracle agent"), /The bench's oracle agent plays replies from a file/);
});

test('in production the line refuses a work item whose agent has a script', () => {
  process.env.NODE_ENV = 'production';
  assert.throws(() => providerFor('build', { agent: { script: scriptFile() } }, {}), /refused when NODE_ENV=production/);
});

test('the mock and echo providers are not workers, and no AI_PROVIDER with no key is no model', () => {
  for (const AI_PROVIDER of ['mock', 'echo', ' Mock ']) assert.equal(modelConfigured({ AI_PROVIDER, ANTHROPIC_API_KEY: 'k' }), false);
  assert.equal(modelConfigured({}), false);
  assert.equal(modelConfigured({ ANTHROPIC_API_KEY: 'k' }), true);
});

test('the Factory\'s public API exports no fake clock and no mock or echo provider', () => {
  for (const name of ['createFakeClock', 'createMockProvider', 'createEchoProvider']) assert.equal(name in factory, false, `${name} is exported`);
});
