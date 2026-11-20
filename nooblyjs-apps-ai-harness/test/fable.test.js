import assert from 'node:assert/strict';
import { test } from 'node:test';
import { costOf } from '../src/core/cost.js';
import { contextWindowFor } from '../src/context/tokens.js';
import { providerForModel } from '../src/providers/index.js';
import { buildRequest } from 'nooblyjs-core/ai/providers/anthropic';

const FABLE = ['claude-fable-5-2', 'claude-fable-5-1', 'claude-fable-5'];

test('Fable models route to the Anthropic provider', () => {
  for (const model of FABLE) assert.equal(providerForModel(model), 'anthropic', model);
});

test('Fable models have a 1M context window', () => {
  for (const model of FABLE) assert.equal(contextWindowFor(model), 1_000_000, model);
});

test('Fable models are priced per million tokens', () => {
  // Fable 5.2: $8 in, $40 out
  assert.equal(costOf('claude-fable-5-2', { input_tokens: 1_000_000, output_tokens: 1_000_000 }), 48);
  // Fable 5.1 and Fable 5: $10 in, $50 out
  assert.equal(costOf('claude-fable-5-1', { input_tokens: 1_000_000, output_tokens: 1_000_000 }), 60);
  assert.equal(costOf('claude-fable-5', { input_tokens: 1_000_000, output_tokens: 1_000_000 }), 60);
});

test('Fable 5.2 omits temperature, because the API rejects it', () => {
  const { init } = buildRequest({ apiKey: 'k', model: 'claude-fable-5-2', system: 's', messages: [], maxTokens: 100, temperature: 0.5 });
  assert.equal(JSON.parse(init.body).temperature, undefined);
});
