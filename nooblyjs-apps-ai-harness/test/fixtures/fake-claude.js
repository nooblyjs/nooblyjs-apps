// A stand-in for the Claude Code CLI, so tests never call the real service.
// It records its arguments and stdin in $FAKE_CLAUDE_LOG (JSON), then replays the
// stream-json lines that the real `claude -p --output-format stream-json` prints.
//   FAKE_CLAUDE_MODE=ok     (default) a reply "Hello there"
//   FAKE_CLAUDE_MODE=error  the CLI's own "not logged in" failure
//   FAKE_CLAUDE_MODE=crash  exits with code 3 and no reply
import { readFileSync, writeFileSync } from 'node:fs';

const mode = process.env.FAKE_CLAUDE_MODE ?? 'ok';
const stdin = readFileSync(0, 'utf8');

if (process.env.FAKE_CLAUDE_LOG) {
  writeFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify({ argv: process.argv.slice(2), stdin }));
}

const out = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);

if (mode === 'crash') {
  process.stderr.write('boom: something went wrong\n');
  process.exit(3);
}

out({ type: 'system', subtype: 'init', tools: [], model: 'claude-haiku-5-5' });

if (mode === 'error') {
  out({ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in · Please run /login', usage: {} });
  process.exit(0);
}

const model = process.argv[process.argv.indexOf('--model') + 1];
out({ type: 'stream_event', event: { type: 'message_start', message: { model, usage: { input_tokens: 12, output_tokens: 0 } } } });
out({ type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } });
for (const word of ['Hello', ' there']) {
  out({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: word } } });
}
out({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } });
out({ type: 'assistant', message: { model, content: [{ type: 'text', text: 'Hello there' }] } });
out({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: 'Hello there',
  stop_reason: 'end_turn',
  usage: { input_tokens: 12, output_tokens: 4, cache_read_input_tokens: 100, cache_creation_input_tokens: 5 },
});
