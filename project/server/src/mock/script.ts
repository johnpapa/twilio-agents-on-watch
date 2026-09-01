import { archiveAndDropColumn, dropColumn, inspectUnusedColumns } from '../db.js';
import { publish } from '../sse.js';
import { setLastRunSummary } from '../agent/context.js';

const MOCK_PRESENTER_NUMBER = '+15550100100';
const IGNORE_WINDOW_SEC = 14; // long enough that the presenter has to actually let it ring

/**
 * Plays the exact same beat sheet as the real run, on a fixed schedule,
 * with no model key and no Twilio spend. The schema work is real --
 * inspectSchema and applyChange hit the same SQLite db as `npm start` --
 * only the network calls (LLM + Twilio) are scripted.
 */
export async function runMockScript(runId: string, prompt: string): Promise<void> {
  publish(runId, { type: 'run-start', prompt, mock: true });
  await sleep(300);

  publish(runId, { type: 'tool-call', tool: 'inspectSchema', args: {} });
  publish(runId, { type: 'step', tool: 'inspectSchema', message: 'reading schema…' });
  await sleep(500);

  const columns = inspectUnusedColumns();
  publish(runId, {
    type: 'step',
    tool: 'inspectSchema',
    message: `found ${columns.length} unused columns: ${columns.map((c) => c.name).join(', ')}`,
  });
  await sleep(500);

  publish(runId, { type: 'step', tool: 'inspectSchema', message: 'checking row counts…' });
  await sleep(600);

  const risky = columns.find((c) => c.populatedRows > 0);
  const safe = columns.filter((c) => c.populatedRows === 0).map((c) => c.name);

  for (const col of columns) {
    if (col.populatedRows > 0) {
      publish(runId, {
        type: 'step',
        tool: 'inspectSchema',
        message: `${col.name} holds ${col.populatedRows.toLocaleString()} rows — irreversible, asking a human`,
        severity: 'irreversible',
      });
    } else {
      publish(runId, { type: 'step', tool: 'inspectSchema', message: `${col.name} is empty — safe to drop` });
    }
    await sleep(250);
  }
  publish(runId, { type: 'tool-result', tool: 'inspectSchema', result: { unusedColumns: columns } });

  const question = risky
    ? `Found ${risky.populatedRows.toLocaleString()} live rows in ${risky.name}. Drop it, or archive it first?`
    : 'All unused columns are empty. OK to drop them?';

  publish(runId, { type: 'tool-call', tool: 'askHuman', args: { question } });
  publish(runId, { type: 'message-sent', to: MOCK_PRESENTER_NUMBER, body: `${question} (mock)` });

  for (let sec = 0; sec <= IGNORE_WINDOW_SEC; sec++) {
    publish(runId, { type: 'waiting', elapsedSec: sec });
    await sleep(1000);
  }

  publish(runId, { type: 'escalating', message: 'no answer — escalating to voice' });
  await sleep(400);
  publish(runId, { type: 'calling', to: MOCK_PRESENTER_NUMBER, mock: true });
  await sleep(3500);

  const decision = 'archive it';
  publish(runId, { type: 'reply', text: decision, via: 'whatsapp-after-call' });
  publish(runId, { type: 'tool-result', tool: 'askHuman', result: { decision, via: 'whatsapp-after-call' } });
  await sleep(500);

  publish(runId, { type: 'tool-call', tool: 'applyChange', args: { decision } });
  publish(runId, { type: 'step', tool: 'applyChange', message: `decision: "${decision}"` });
  await sleep(400);

  let archivedRows = 0;
  if (risky) {
    publish(runId, {
      type: 'step',
      tool: 'applyChange',
      message: `archiving ${risky.name} (${risky.populatedRows.toLocaleString()} rows) before dropping…`,
    });
    const result = archiveAndDropColumn(risky.name);
    archivedRows = result.archivedRows;
    await sleep(500);
  }

  for (const col of safe) {
    publish(runId, { type: 'step', tool: 'applyChange', message: `dropping ${col} (empty)…` });
    dropColumn(col);
    await sleep(300);
  }

  publish(runId, { type: 'step', tool: 'applyChange', message: 'opening PR… (skipped: MOCK=1)' });
  await sleep(400);

  const droppedColumns = [risky?.name, ...safe].filter(Boolean) as string[];
  const prUrl = null;

  publish(runId, {
    type: 'applied',
    droppedColumns,
    archivedColumn: risky?.name ?? null,
    archivedRows,
    prUrl,
  });
  publish(runId, {
    type: 'tool-result',
    tool: 'applyChange',
    result: { droppedColumns, archivedColumn: risky?.name ?? null, archivedRows, prUrl },
  });

  setLastRunSummary({
    prompt,
    decision,
    droppedColumns,
    archivedColumn: risky?.name ?? null,
    archivedRows,
    prUrl,
  });

  publish(runId, { type: 'done', text: 'Archived and dropped the unused columns. PR skipped in practice mode.' });

  await sleep(2500);
  const closingQuestion = 'why did you archive instead of dropping?';
  const closingAnswer = `${risky?.name ?? 'the column'} still had ${archivedRows.toLocaleString()} live rows, so dropping it outright would've been a real data loss. Archiving first keeps it recoverable.`;
  publish(runId, { type: 'closing-question', from: MOCK_PRESENTER_NUMBER, text: closingQuestion, mock: true });
  await sleep(1200);
  publish(runId, { type: 'closing-answer', to: MOCK_PRESENTER_NUMBER, text: closingAnswer, mock: true });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
