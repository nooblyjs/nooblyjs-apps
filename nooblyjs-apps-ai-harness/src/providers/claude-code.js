// Talk to Claude through the Claude Code CLI, so a Claude subscription (Pro/Max) can be used
// instead of an API key. Run `claude` once and sign in with /login; noobly then starts
// `claude -p` as a child process for every reply.
//
// The CLI runs its own agent loop, with its own tools (Read, Write, Edit, Bash…). We let it
// do everything: --permission-mode bypassPermissions means it never stops to ask. noobly's
// permission rules, sandbox, plan mode and checkpoints do NOT apply to these calls.
//   - the conversation so far is flattened into text and sent on stdin, and the CLI's default
//     system prompt is replaced with ours (--system-prompt).
//   - the CLI's final answer comes back as the reply; the tool work happens inside the CLI.
//
// The CLI prints one JSON object per line (--output-format stream-json). We read:
//   stream_event / text_delta  → TEXT_DELTA (the reply, word by word)
//   result                     → MESSAGE (the whole reply, and its token usage)
// Everything else (init, rate limits, assistant snapshots) is ignored.
import { spawn as nodeSpawn } from 'node:child_process';
import readline from 'node:readline';
import { EVENT } from '../core/events.js';
import { ApiError } from './errors.js';

export const CLAUDE_CODE_SYSTEM_NOTE =
  'You are running inside noobly, a coding assistant. You have your usual tools (reading, writing and ' +
  'editing files, running commands). Use them when the user asks you to act on the project.';

/**
 * @param {{ command?: string, baseArgs?: string[], spawnImpl?: Function, cwd?: string }} [options]
 *   command/baseArgs: how to start the CLI (baseArgs go before noobly's own flags; tests use them).
 */
export function createClaudeCodeProvider({ command = 'claude', baseArgs = [], spawnImpl = nodeSpawn, cwd } = {}) {
  return {
    name: 'claude-code',

    async *stream({ model, system, context, messages }, { signal } = {}) {
      const args = [...baseArgs, ...buildArgs({ model, system, context })];
      const prompt = buildPrompt(messages);

      let child;
      try {
        child = spawnImpl(command, args, { cwd, signal, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (error) {
        throw cliError(error.code === 'ENOENT' ? notInstalledMessage(command) : error.message);
      }

      let stderr = '';
      child.stderr?.on('data', (chunk) => {
        stderr += chunk;
      });
      // A missing binary shows up as an 'error' event, not an exception from spawn.
      let spawnError = null;
      child.once('error', (error) => {
        spawnError = error.code === 'ENOENT' ? cliError(notInstalledMessage(command)) : error;
      });

      child.stdin.on('error', () => {}); // the CLI may exit before reading all of stdin
      child.stdin.end(prompt);

      const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
      let sawResult = false;
      let text = '';
      try {
        for await (const line of lines) {
          const event = parseLine(line);
          if (!event) continue;

          if (event.type === 'stream_event') {
            const inner = event.event;
            if (inner?.type === 'message_start') {
              yield { type: EVENT.MESSAGE_START, model: inner.message?.model ?? model, usage: usageOf(inner.message?.usage) };
            } else if (inner?.type === 'content_block_delta' && inner.delta?.type === 'text_delta') {
              text += inner.delta.text;
              yield { type: EVENT.TEXT_DELTA, text: inner.delta.text };
            }
          } else if (event.type === 'result') {
            sawResult = true;
            if (event.is_error) throw resultError(event);
            yield {
              type: EVENT.MESSAGE,
              message: {
                model,
                content: [{ type: 'text', text: event.result ?? text }],
                stop_reason: 'end_turn',
                usage: usageOf(event.usage),
              },
            };
          }
        }
      } finally {
        lines.close();
        if (child.exitCode === null && !child.killed) child.kill();
      }

      const exit = await new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve({ code: child.exitCode, signal: child.signalCode });
        child.once('close', (code, sig) => resolve({ code, signal: sig }));
      });
      if (signal?.aborted) return;
      if (spawnError) throw spawnError;
      if (!sawResult) {
        const detail = stderr.trim() || `exited with code ${exit.code ?? exit.signal}`;
        throw cliError(`The Claude Code CLI stopped without a reply: ${detail}`);
      }
    },
  };
}

/** The arguments for one `claude -p` call. */
export function buildArgs({ model, system, context }) {
  const systemText = [system, context, CLAUDE_CODE_SYSTEM_NOTE].filter((part) => typeof part === 'string' && part).join('\n\n');
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--no-session-persistence',
    '--permission-mode', 'bypassPermissions',
    '--system-prompt', systemText,
  ];
  if (model) args.push('--model', model);
  return args;
}

/** The conversation so far as plain text. Earlier tool calls and results become short notes, so the CLI knows what happened. */
export function buildPrompt(messages = []) {
  const turns = messages.map((message) => {
    const who = message.role === 'assistant' ? 'Assistant' : 'User';
    return `${who}: ${blocksToText(message.content)}`;
  });
  return [
    'Here is the conversation so far. Reply to the last user message, using tools as needed.',
    '',
    '<conversation>',
    turns.join('\n\n'),
    '</conversation>',
  ].join('\n');
}

function blocksToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => {
      switch (block.type) {
        case 'text':
          return block.text;
        case 'tool_use':
          return `[asked to run tool ${block.name} with ${JSON.stringify(block.input)}]`;
        case 'tool_result': {
          const body = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
          return `[tool result${block.is_error ? ' (error)' : ''}: ${body}]`;
        }
        case 'image':
          return '[image]';
        default:
          return ''; // thinking blocks and anything unknown are left out
      }
    })
    .filter(Boolean)
    .join('\n');
}

function parseLine(line) {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null; // a stray non-JSON line (a warning, say) is not an event
  }
}

function usageOf(usage = {}) {
  return {
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/** The CLI reports its own failures as a `result` with is_error: true, e.g. "Not logged in · Please run /login". */
function resultError(event) {
  const message = String(event.result ?? 'Unknown error');
  if (/rate limit|\b429\b/i.test(message)) return new ApiError(429, 'rate_limit_error', message);
  if (/overloaded|\b529\b/i.test(message)) return new ApiError(529, 'overloaded_error', message);
  return cliError(message);
}

function cliError(message) {
  return new ApiError(0, 'claude_code_error', message);
}

function notInstalledMessage(command) {
  return `Could not start "${command}". Install Claude Code (https://claude.com/claude-code), run \`claude\` and sign in with /login.`;
}
