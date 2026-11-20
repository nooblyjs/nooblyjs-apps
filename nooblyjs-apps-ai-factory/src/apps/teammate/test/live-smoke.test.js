// The dry run of scripts/live-smoke.js (moved here in NooblyJS Phase 27: the script makes real calls only). The same
// three tasks, one per model tier, run on the offline mock: each produces output, usage and a timesheet entry.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

const RUNS = [
  { teammate: 'otis-fern', task: 'In two sentences: what is the safest way to deduplicate a CRM export with fuzzy company names?' },
  { teammate: 'wren-sato', task: 'Write a three-line account brief for a fictional company called Acme Robotics, with an opening line for a sales rep.' },
  { teammate: 'ada-quill', task: 'List three questions you would ask before starting a competitor scan, in a short bulleted list.' },
];

let app;
before(async () => { app = await startApp(); });
after(() => app.close());

for (const run of RUNS) {
  test(`smoke dry run: ${run.teammate} answers, with usage and a bill`, async () => {
    const r = await app.invocation.assign(run.teammate, { task: run.task });
    assert.ok(r.output.trim(), 'empty output');
    assert.ok(r.usage.outputTokens > 0, 'no usage');
    assert.ok(r.hours > 0 && r.amount >= 0);
    const work = await app.repos.work.get(run.teammate, r.workId);
    assert.equal(work.status, 'succeeded');
  });
}
