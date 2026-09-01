/**
 * The last completed run's summary, so a follow-up text after the demo
 * ("why did you archive instead of dropping?") can be answered with real
 * context instead of the agent making something up.
 */

export interface RunSummary {
  prompt: string;
  decision: string;
  droppedColumns: string[];
  archivedColumn: string | null;
  archivedRows: number;
  prUrl: string | null;
}

let lastRunSummary: RunSummary | null = null;

export function setLastRunSummary(summary: RunSummary) {
  lastRunSummary = summary;
}

export function getLastRunSummary(): RunSummary | null {
  return lastRunSummary;
}
