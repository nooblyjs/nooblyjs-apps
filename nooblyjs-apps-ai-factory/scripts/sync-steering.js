// npm run steering:sync          copies .claude/steering/nooblyjs-ai-shared-rules.md into each app's
//                                .claude/steering/nooblyjs-ai.md, so an agent working in an app loads the shared rules
// npm run steering:sync -- --check  changes nothing; exits 1 if any copy is missing or out of date
// The solution root owns everything shared (structure.md §1a); the copies are generated and never edited by hand.
// The rules name every path from the solution root, so each copy is a byte copy of the source.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The solution root: the host at the top, its apps under src/apps/. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE = path.join(ROOT, '.claude', 'steering', 'nooblyjs-ai-shared-rules.md');
// The folders that get a copy, relative to the solution root: every app under src/apps/, and the agent harness, which
// sits beside the solution in nooblyjs-apps. nooblyjs-core, with the AI module, is a general library, so it gets no copy.
// The Software Factory's Test section (src/apps/factory/quality) reads the Factory's copy.
export const EXTERNAL = ['../nooblyjs-apps-ai-harness'];

async function repoDirs(root) {
  const apps = (await fs.readdir(path.join(root, 'src', 'apps'), { withFileTypes: true }).catch(() => []))
    .filter((d) => d.isDirectory()).map((d) => `src/apps/${d.name}`);
  return [...apps.sort(), ...EXTERNAL];
}

/** Each folder that exists, with where its copy goes and whether that copy matches the source. */
export async function steeringCopies({ root = ROOT } = {}) {
  const source = await fs.readFile(SOURCE, 'utf8');
  const copies = [];
  for (const repoDir of await repoDirs(root)) {
    const dir = path.join(root, repoDir);
    if (!(await fs.stat(dir).catch(() => null))?.isDirectory()) continue;
    const target = path.join(dir, '.claude', 'steering', 'nooblyjs-ai.md');
    const now = await fs.readFile(target, 'utf8').catch(() => null);
    copies.push({ repo: repoDir, target, source, current: now === source });
  }
  return copies;
}

async function main() {
  const check = process.argv.includes('--check');
  const copies = await steeringCopies();
  const stale = copies.filter((c) => !c.current);
  if (check) {
    for (const c of stale) console.error(`out of date: ${c.repo}/.claude/steering/nooblyjs-ai.md (run npm run steering:sync)`);
    if (!stale.length) console.log(`steering: ${copies.length} copies match .claude/steering/nooblyjs-ai-shared-rules.md`);
    process.exitCode = stale.length ? 1 : 0;
    return;
  }
  for (const c of stale) {
    await fs.mkdir(path.dirname(c.target), { recursive: true });
    await fs.writeFile(c.target, c.source);
    console.log(`wrote ${c.repo}/.claude/steering/nooblyjs-ai.md`);
  }
  console.log(`steering: ${copies.length} copies, ${stale.length} updated`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
