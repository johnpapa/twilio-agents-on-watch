#!/usr/bin/env -S npx tsx
/**
 * Tests the pure decision logic of the escalation hook.
 *
 * The Twilio round trip and the live Claude Code invocation are not covered
 * here -- both need real credentials and a real agent session. What IS worth
 * pinning down is the bit that would be expensive to get wrong: an ambiguous
 * or missing reply must never come back as `allow`.
 *
 * Run:  npx tsx src/hooks/ask-human-hook.test.ts (from server/)
 */
import { decisionFromReply, describeToolCall, type Decision } from './ask-human-hook.js';

const cases: [string | null | undefined, Decision][] = [
  ['yes', 'allow'],
  ['Yes', 'allow'],
  ['  ok  ', 'allow'],
  ['go', 'allow'],
  ['ship it', 'allow'],
  ['approved', 'allow'],
  ['yep', 'allow'],
  ['no', 'deny'],
  ['NO', 'deny'],
  ['stop', 'deny'],
  ["don't", 'deny'],
  ['abort', 'deny'],
  ['nope', 'deny'],
  // Anything we can't read as a clear yes must not be treated as one.
  ['what does it do?', 'deny'],
  ['maybe later', 'deny'],
  ['yolo', 'deny'],
  // Silence falls back to Claude Code's own prompt, never to allow.
  [null, 'ask'],
  [undefined, 'ask'],
  ['', 'ask'],
];

let failed = 0;
for (const [input, want] of cases) {
  const got = decisionFromReply(input);
  if (got !== want) {
    failed++;
    console.error(`FAIL  ${JSON.stringify(input)} -> ${got}, wanted ${want}`);
  }
}

const described = [
  [describeToolCall('Bash', { command: 'rm -rf build/' }), 'Bash: rm -rf build/'],
  [describeToolCall('Edit', { file_path: '/srv/app/db.ts' }), 'Edit: /srv/app/db.ts'],
  [describeToolCall('Unknown', {}), 'Unknown'],
];
for (const [got, want] of described) {
  if (got !== want) {
    failed++;
    console.error(`FAIL  describeToolCall -> ${got}, wanted ${want}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`ok — ${cases.length + described.length} assertions passed`);
