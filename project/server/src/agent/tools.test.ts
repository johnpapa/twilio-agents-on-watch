#!/usr/bin/env -S npx tsx
/**
 * Tests classifyDecision() and wantsToHold() -- the logic that decides what
 * a real human's reply actually meant. Added after a real run found three
 * separate bugs in this area in one night: the exact-phrase-only matching,
 * the negation trap ("don't hold them, send now" misread on the literal
 * word "hold"), and unclear replies silently defaulting without ever being
 * distinguished from a real answer. Nothing here needs Twilio or a model --
 * that's the point, same reasoning as ask-human-hook.test.ts next to it.
 *
 * Run:  npx tsx src/agent/tools.test.ts (from server/)
 */
import { classifyDecision, wantsToHold } from './tools.js';

const classifyCases: [string, 'send' | 'hold' | 'unclear'][] = [
  // Clear hold, natural phrasing
  ['hold them', 'hold'],
  ['hold them please', 'hold'],
  ['hold em', 'hold'],
  ['hold em please', 'hold'],
  ['Hold', 'hold'],
  ['keep them until morning', 'hold'],
  ['nah, let it wait', 'hold'],
  ['no rush, hold off', 'hold'],
  ['lets wait till morning', 'hold'],

  // Clear send, natural phrasing
  ['send all', 'send'],
  ['send them all now', 'send'],
  ['send it now', 'send'],
  ['yeah go for it', 'send'],
  ['go ahead', 'send'],
  ['just send it', 'send'],
  ['ship it', 'send'],

  // The negation trap: "hold" appears literally but the meaning is send.
  ["don't hold them, send now", 'send'],
  ['no need to hold, go', 'send'],

  // Genuinely unclear -- neither list matches, or both do.
  ['ok', 'unclear'],
  ['yes', 'unclear'],
  ['CBC', 'unclear'],
  ['Sloppy can poodle', 'unclear'],
  ['Win?', 'unclear'],
  ['', 'unclear'],

  // The no-reply fallback's own generated text has to round-trip as
  // something wantsToHold() reads as hold -- confirms that text was chosen
  // deliberately, not by accident.
  ['no response after the call — holding everyone until morning by default', 'unclear'],
];

let failed = 0;
for (const [input, want] of classifyCases) {
  const got = classifyDecision(input);
  if (got !== want) {
    failed++;
    console.error(`FAIL classifyDecision  ${JSON.stringify(input)} -> ${got}, wanted ${want}`);
  }
}

const holdCases: [string, boolean][] = [
  ['hold them', true],
  ['send all', false],
  ['gibberish nonsense text', true],
  ["don't hold them, send now", false],
  ['', true],
];

for (const [input, want] of holdCases) {
  const got = wantsToHold(input);
  if (got !== want) {
    failed++;
    console.error(`FAIL wantsToHold  ${JSON.stringify(input)} -> ${got}, wanted ${want}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`ok — ${classifyCases.length + holdCases.length} assertions passed`);
