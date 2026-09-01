import { askHuman } from './askHuman.js';
import { scenario } from './fakeChannel.js';

// Try: node run.js quick-reply | node run.js ignored | node run.js never
const mode = process.argv[2] ?? 'ignored';
const scenarios = {
  'quick-reply': 1500, // replies within the text-wait window -- no call happens
  ignored: 4500, // ignores the text, replies only after the call goes out
  never: null, // never replies at all -- askHuman() should throw
};

if (!(mode in scenarios)) {
  console.error(`Unknown scenario "${mode}". Try: quick-reply, ignored, never`);
  process.exit(1);
}
scenario(scenarios[mode]);

console.log(`--- scenario: ${mode} ---`);
try {
  const decision = await askHuman('Found 12,400 live rows. Drop it, or archive it first?');
  console.log(`\nFinal decision: "${decision}"`);
} catch (err) {
  console.log(`\nThrew as expected: ${err instanceof Error ? err.message : err}`);
}
