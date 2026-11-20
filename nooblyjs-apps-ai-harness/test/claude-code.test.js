import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runCommand } from '../src/commands/index.js';
import { Session } from '../src/core/session.js';
import { EVENT } from '../src/core/events.js';
import { buildArgs, buildPrompt, createClaudeCodeProvider } from '../src/providers/claude-code.js';
import { chooseProvider, createProvider, PROVIDERS } from '../src/providers/index.js';

const FAKE = fileURLToPath(new URL('./fixtures/fake-claude.js', import.meta.url));

function fakeProvider(mode = 'ok', logPath) {
  const saved = { mode: process.env.FAKE_CLAUDE_MODE, log: process.env.FAKE_CLAUDE_LOG };
  process.env.FAKE_CLAUDE_MODE = mode;
  if (logPath) process.env.FAKE_CLAUDE_LOG = logPath;
  const provider = createClaudeCodeProvider({ command: process.execPath, baseArgs: [FAKE] });
  return { provider, restore: () => {
    if (saved.mode === undefined) delete process.env.FAKE_CLAUDE_MODE; else process.env.FAKE_CLAUDE_MODE = saved.mode;
    if (saved.log === undefined) delete process.env.FAKE_CLAUDE_LOG; else process.env.FAKE_CLAUDE_LOG = saved.log;
  } };
}

async function collect(stream) {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
}

test('it is an opt-in provider with no key, and is never picked automatically', () => {
  assert.equal(PROVIDERS['claude-code'].envKeys.length, 0);
  assert.equal(chooseProvider({ requested: 'claude-code', env: {} }).id, 'claude-code');
  // Even with no API keys at all, the error only lists the key-based providers.
  assert.throws(() => chooseProvider({ env: {} }), (error) => !/claude-code/.test(error.message));
  assert.equal(createProvider('claude-code').name, 'claude-code');
});

test('the CLI gets print mode, streaming JSON, bypassed permissions, our system prompt and the model', () => {
  const args = buildArgs({ model: 'claude-haiku-5-5', system: 'Be brief.', context: 'Memory: the user likes tea.' });
  assert.deepEqual(args.slice(0, 1), ['-p']);
  assert.equal(args[args.indexOf('--output-format') + 1], 'stream-json');
  assert.equal(args[args.indexOf('--permission-mode') + 1], 'bypassPermissions');
  assert.ok(!args.includes('--tools'));
  assert.equal(args[args.indexOf('--model') + 1], 'claude-haiku-5-5');
  const system = args[args.indexOf('--system-prompt') + 1];
  assert.match(system, /Be brief\.[\s\S]*Memory: the user likes tea\.[\s\S]*usual tools/);
});

test('the conversation is flattened into text, with earlier tool calls as notes', () => {
  const prompt = buildPrompt([
    { role: 'user', content: 'What is in package.json?' },
    { role: 'assistant', content: [{ type: 'text', text: 'Let me look.' }, { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'package.json' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"name":"x"}' }] },
    { role: 'user', content: [{ type: 'thinking', thinking: 'secret' }, { type: 'text', text: 'Summarise it.' }] },
  ]);
  assert.match(prompt, /User: What is in package\.json\?/);
  assert.match(prompt, /Assistant: Let me look\.\n\[asked to run tool Read with \{"file_path":"package\.json"\}\]/);
  assert.match(prompt, /\[tool result: \{"name":"x"\}\]/);
  assert.match(prompt, /User: Summarise it\./);
  assert.doesNotMatch(prompt, /secret/);
});

test('streamed text arrives as TEXT_DELTA, then one MESSAGE with the whole reply and its usage', async () => {
  const logPath = join(mkdtempSync(join(tmpdir(), 'claude-code-')), 'log.json');
  const { provider, restore } = fakeProvider('ok', logPath);
  try {
    const events = await collect(provider.stream({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'Say hi' }] }));
    assert.equal(events[0].type, EVENT.MESSAGE_START);
    assert.equal(events[0].model, 'claude-haiku-5-5');
    assert.deepEqual(events.filter((e) => e.type === EVENT.TEXT_DELTA).map((e) => e.text), ['Hello', ' there']);
    const message = events.at(-1);
    assert.equal(message.type, EVENT.MESSAGE);
    assert.deepEqual(message.message.content, [{ type: 'text', text: 'Hello there' }]);
    assert.equal(message.message.stop_reason, 'end_turn');
    assert.equal(message.message.usage.cache_read_input_tokens, 100);

    const sent = JSON.parse(readFileSync(logPath, 'utf8'));
    assert.ok(sent.argv.includes('bypassPermissions'));
    assert.match(sent.stdin, /<conversation>\nUser: Say hi\n<\/conversation>/);
  } finally {
    restore();
    rmSync(logPath, { force: true });
  }
});

test('a "not logged in" result is a clear error, not a reply', async () => {
  const { provider, restore } = fakeProvider('error');
  try {
    await assert.rejects(collect(provider.stream({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'hi' }] })), /Not logged in/);
  } finally {
    restore();
  }
});

test('a CLI that exits without a reply says so, with its stderr', async () => {
  const { provider, restore } = fakeProvider('crash');
  try {
    await assert.rejects(collect(provider.stream({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'hi' }] })), /stopped without a reply: boom/);
  } finally {
    restore();
  }
});

test('a missing claude command gives install instructions', async () => {
  const provider = createClaudeCodeProvider({ command: '/nonexistent/claude-binary-for-test' });
  await assert.rejects(collect(provider.stream({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'hi' }] })), /Could not start.*sign in with \/login/);
});

test('a full session turn works through the claude-code provider', async () => {
  const { provider, restore } = fakeProvider('ok');
  try {
    const session = new Session({ provider, providerId: 'claude-code', model: 'claude-haiku-5-5' });
    await session.send('hello');
    assert.equal(session.history.length, 2);
    assert.equal(session.history.at(-1).content.at(-1).text, 'Hello there');
  } finally {
    restore();
  }
});

test('on claude-code, /model with a Claude name stays on that provider', async () => {
  const session = new Session({ provider: createClaudeCodeProvider(), providerId: 'claude-code', model: 'claude-haiku-5-5' });
  const saved = { ...process.env };
  try {
    process.env.ANTHROPIC_API_KEY = 'a';
    const result = await runCommand('/model claude-sonnet-5-5', session);
    assert.match(result.text, /Model set to claude-sonnet-5-5/);
    assert.equal(session.providerId, 'claude-code');
  } finally {
    process.env = saved;
  }
});
