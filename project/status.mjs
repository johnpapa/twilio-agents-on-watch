#!/usr/bin/env node
// A scorecard, not a grader. This checks for evidence you've been through
// each level -- files existing, env vars filled in -- not that the code
// actually works. Run the level's own verification steps for that.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// Look wherever server/src/env.ts looks, so the scorecard and the app never
// disagree about whether you're set up. Reporting a level uncleared because
// .env is one directory over would be a lie about your own progress.
function readEnv() {
  const env = {};
  for (const path of [join(__dirname, '.env'), join(__dirname, 'server', '.env')]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match && match[2].trim() && !(match[1] in env)) env[match[1]] = match[2].trim();
    }
  }
  return env;
}

function levelSolved(relativePath) {
  const path = join(repoRoot, relativePath);
  if (!existsSync(path)) return false;
  return !readFileSync(path, 'utf8').includes('TODO');
}

const env = readEnv();
const depsInstalled = existsSync(join(__dirname, 'server', 'node_modules'));
const level01Solved = levelSolved('01-build-the-escalation-ladder/starter/askHuman.js');
const level02Attempted = existsSync(join(__dirname, 'server/src/scripts/hello-whatsapp.ts'));
const level03Attempted = existsSync(join(__dirname, 'server/src/scripts/hello-call.ts'));
const hasTwilioAuth = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET);
const hasVoiceNumber = Boolean(env.TWILIO_VOICE_NUMBER);
const hasModelKey = Boolean(env.ANTHROPIC_API_KEY);

const levels = [
  { icon: '🎬', label: '00 — Run the Demo', cleared: depsInstalled },
  { icon: '🧩', label: '01 — Build the Escalation Ladder', cleared: level01Solved },
  { icon: '💬', label: '02 — Send and Receive Real Texts', cleared: level02Attempted && hasTwilioAuth },
  { icon: '👑', label: '03 — Place a Real Call (boss)', cleared: level03Attempted && hasVoiceNumber },
  { icon: '📡', label: '04 — Stay Reachable After the Call', cleared: hasModelKey },
];

const clearedCount = levels.filter((l) => l.cleared).length;

console.log('');
console.log('  🎮 Twilio Agents for Beginners — Progress');
console.log('');
for (const level of levels) {
  const mark = level.cleared ? '✓' : ' ';
  console.log(`  [${mark}] ${level.icon}  ${level.label}`);
}
console.log('');
console.log(`  ${clearedCount}/${levels.length} levels cleared`);
console.log('');

if (clearedCount === levels.length) {
  console.log('  🏆 GAME COMPLETE');
  console.log('  You built an agent that texts, calls, and stays reachable. For real.');
  console.log('  Go text some friends the sandbox number.');
  console.log('');
}

console.log(
  '  (This is a best-effort read, not a grader -- it checks that files exist',
);
console.log('  and env vars are set, not that the code actually works. Trust each');
console.log("  level's own verification steps for that.)");
console.log('');
