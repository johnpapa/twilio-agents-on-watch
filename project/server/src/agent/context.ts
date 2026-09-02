/**
 * The last completed run's summary, so a follow-up text after the demo
 * ("why didn't you send to everyone?") can be answered with real context
 * instead of the agent making something up.
 */

export interface RunSummary {
  prompt: string;
  /** What the human replied, verbatim. */
  decision: string;
  /** Everyone the outage affected. */
  total: number;
  /** How many were notified straight away. */
  sentNow: number;
  /** How many were queued for the morning; 0 if the human said send to all. */
  scheduled: number;
  /** The do-not-disturb window, e.g. "23:00–07:00". */
  quietWindow: string;
  heldUntilMorning: boolean;
}

let lastRunSummary: RunSummary | null = null;

export function setLastRunSummary(summary: RunSummary) {
  lastRunSummary = summary;
}

export function getLastRunSummary(): RunSummary | null {
  return lastRunSummary;
}
