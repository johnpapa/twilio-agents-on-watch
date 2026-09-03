import type { AudienceSlice } from '../db.js';

/**
 * The exact words used to escalate to a human -- texted, spoken on the
 * fallback call, and replayed identically in practice mode. One function so
 * a wording fix (or a bug fix, like a number read aloud wrong) can't land in
 * one of the three run paths and be missed in the other two.
 */
export function buildEscalationQuestion(slice: AudienceSlice): string {
  return (
    `${slice.asleep} of these people are asleep right now — it's between ` +
    `${slice.quietWindow} where they live. Send to everyone now, or hold those until 8am?`
  );
}
