// NooblyJS Phase 27 (M-33): the workflow steps that build the AI registry in a worker pass no app, instead of a Proxy
// or a plain-object stub standing in for Express. initializeAIInstances works without one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('initializeAIInstances runs with no app, and the registry is still published', async () => {
  const { initializeAIInstances } = require('../src/datasources/lib/aiInstances.cjs');
  const appBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-ai-'));
  fs.mkdirSync(path.join(appBaseDir, 'configuration', 'settings'), { recursive: true });
  fs.writeFileSync(path.join(appBaseDir, 'configuration', 'settings', 'settings-agents.json'), '[]');
  const log = { info() {}, warn() {}, error() {} };
  const registry = await initializeAIInstances({ serviceRegistry: require('nooblyjs-core'), app: null, log, appBaseDir });
  assert.equal(global.aiInstances, registry);
  assert.deepEqual(registry.list(), []);
});

test('the worker steps carry no stub app', () => {
  for (const rel of ['workflows/application-design/steps/process.cjs', 'workflows/document-processing/steps/clean-document.cjs']) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.doesNotMatch(src, /appStub|new Proxy|const noop/, rel);
    assert.match(src, /app: null/, rel);
  }
});
