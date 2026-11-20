// Every NooblyJS document follows the Open Knowledge Format (OKF) v0.2: YAML frontmatter with a type (and a title,
// description and tags), and each documentation bundle has an up-to-date index.md declaring okf_version.
// A new document fails here until `npm run docs:okf` (in nooblyjs-ai-host) has given it frontmatter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, conform, typeFor, OKF_VERSION } from '../scripts/okf.js';

test('every document and every bundle index follows OKF', async () => {
  const { problems, documents, bundles } = await check();
  assert.ok(documents > 300 && bundles >= 10, `only ${documents} documents in ${bundles} bundles found`);
  assert.deepEqual(problems, [], `not OKF (run npm run docs:okf):\n${problems.join('\n')}`);
});

test('conform adds only missing keys, keeps the ones there, and leaves the body alone', () => {
  const body = '# Release runbook\n\nHow a release goes out, step by step.\n\n1. Tag it.\n';
  const out = conform(body, 'nooblyjs-ai-host/.claude/runbooks/release.md');
  assert.match(out, /^---\ntype: Runbook\ntitle: Release runbook\ndescription: How a release goes out, step by step\.\ntags: \[nooblyjs-ai-host, runbooks\]\n---\n\n# Release runbook\n/);
  assert.ok(out.endsWith(body));
  const kiro = '---\ninclusion: always\n---\n\n# Tech\n\nHow it is built, in some detail here.\n';
  const kept = conform(kiro, 'nooblyjs-ai-x/.claude/steering/tech.md');
  assert.match(kept, /^---\ninclusion: always\ntype: Steering\n/);
  assert.equal(conform(kept, 'nooblyjs-ai-x/.claude/steering/tech.md'), null, 'a second run changes nothing');
  assert.equal(OKF_VERSION, '0.2');
});

test('types come from where a document lives', () => {
  assert.equal(typeFor('nooblyjs-ai-host/.claude/specs/phase-27-x/tasks.md'), 'Task List');
  assert.equal(typeFor('nooblyjs-ai-host/.claude/phases/phase-26-summary.md'), 'Phase Summary');
  assert.equal(typeFor('nooblyjs-ai-host/.claude/adr/ADR-001.md'), 'Architecture Decision Record');
  assert.equal(typeFor('nooblyjs-ai-host/CLAUDE.md'), 'Agent Instructions');
  assert.equal(typeFor('.claude/skills/x/SKILL.md'), 'Skill');
  assert.equal(typeFor('.claude/skills/README.md'), 'Reference');
});
