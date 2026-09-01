import { tool } from 'ai';
import { z } from 'zod';
import { archiveAndDropColumn, dropColumn, inspectUnusedColumns, type ColumnStat } from '../db.js';
import { sendMessage, pollForReply } from '../twilio/messaging.js';
import { placeEscalationCall } from '../twilio/voice.js';
import { openSchemaChangePR } from '../github/pr.js';
import { publish } from '../sse.js';
import { PRESENTER_NUMBER } from '../twilio/client.js';
import { setLastRunSummary } from './context.js';

const TEXT_WAIT_MS = 20_000;
const POST_CALL_WAIT_MS = 90_000;
const TICK_MS = 1_000;

export interface RunContext {
  prompt: string;
  unusedColumns: ColumnStat[] | null;
  lastDecision: string | null;
}

export function buildTools(runId: string, ctx: RunContext) {
  const step = (message: string, extra: Record<string, unknown> = {}) =>
    publish(runId, { type: 'step', tool: 'inspectSchema', message, ...extra });

  const inspectSchema = tool({
    description:
      'Inspect the users table schema, find columns the app no longer reads, and check how many rows still hold data in each.',
    parameters: z.object({}),
    execute: async () => {
      publish(runId, { type: 'step', tool: 'inspectSchema', message: 'reading schema…' });
      const columns = inspectUnusedColumns();
      ctx.unusedColumns = columns;

      publish(runId, {
        type: 'step',
        tool: 'inspectSchema',
        message: `found ${columns.length} unused columns: ${columns.map((c) => c.name).join(', ')}`,
      });
      publish(runId, { type: 'step', tool: 'inspectSchema', message: 'checking row counts…' });

      for (const col of columns) {
        if (col.populatedRows > 0) {
          publish(runId, {
            type: 'step',
            tool: 'inspectSchema',
            message: `${col.name} holds ${col.populatedRows.toLocaleString()} rows — irreversible, asking a human`,
            severity: 'irreversible',
          });
        } else {
          publish(runId, {
            type: 'step',
            tool: 'inspectSchema',
            message: `${col.name} is empty — safe to drop`,
          });
        }
      }

      return { unusedColumns: columns };
    },
  });

  const askHuman = tool({
    description:
      'Escalate a decision to a human that the agent should not make alone: text first, and if unanswered, call and speak the question. Returns the human decision as text.',
    parameters: z.object({
      question: z.string().describe('The question to ask the human, in plain language.'),
    }),
    execute: async ({ question }) => {
      const to = PRESENTER_NUMBER();
      const messageBody = `${question} Reply "archive it" or "drop it".`;

      publish(runId, { type: 'message-sent', to, body: messageBody });
      const sentAt = new Date();
      await sendMessage(to, messageBody);

      let ticker = startTicker(runId);
      let reply = await pollForReply({
        from: to,
        since: sentAt,
        timeoutMs: TEXT_WAIT_MS,
        intervalMs: 2000,
        onTick: () => {},
      });
      stopTicker(ticker);

      if (reply) {
        publish(runId, { type: 'reply', text: reply.body, via: 'whatsapp' });
        return { decision: reply.body, via: 'whatsapp' };
      }

      publish(runId, { type: 'escalating', message: 'no answer — escalating to voice' });
      publish(runId, { type: 'calling', to });
      await placeEscalationCall(to, question);

      ticker = startTicker(runId);
      reply = await pollForReply({
        from: to,
        since: sentAt,
        timeoutMs: POST_CALL_WAIT_MS,
        intervalMs: 2500,
        onTick: () => {},
      });
      stopTicker(ticker);

      if (!reply) {
        publish(runId, { type: 'error', message: 'no reply received after voice escalation' });
        throw new Error('No human response received after voice escalation.');
      }

      publish(runId, { type: 'reply', text: reply.body, via: 'whatsapp-after-call' });
      return { decision: reply.body, via: 'whatsapp-after-call' };
    },
  });

  const applyChange = tool({
    description:
      'Apply the human decision: archive-then-drop the irreversible column, drop the safe columns outright, and open a PR.',
    parameters: z.object({
      decision: z.string().describe('The human decision, e.g. "archive it" or "drop it".'),
    }),
    execute: async ({ decision }) => {
      const columns = ctx.unusedColumns;
      if (!columns) throw new Error('applyChange called before inspectSchema.');

      const risky = columns.find((c) => c.populatedRows > 0);
      const safe = columns.filter((c) => c.populatedRows === 0).map((c) => c.name);

      const wantsArchive = /archive/i.test(decision);
      let archivedRows = 0;

      publish(runId, { type: 'step', tool: 'applyChange', message: `decision: "${decision}"` });

      if (risky) {
        if (wantsArchive) {
          publish(runId, {
            type: 'step',
            tool: 'applyChange',
            message: `archiving ${risky.name} (${risky.populatedRows.toLocaleString()} rows) before dropping…`,
          });
          const result = archiveAndDropColumn(risky.name);
          archivedRows = result.archivedRows;
        } else {
          publish(runId, {
            type: 'step',
            tool: 'applyChange',
            message: `dropping ${risky.name} directly, per human decision`,
          });
          dropColumn(risky.name);
        }
      }

      for (const col of safe) {
        publish(runId, { type: 'step', tool: 'applyChange', message: `dropping ${col} (empty)…` });
        dropColumn(col);
      }

      const droppedColumns = [risky?.name, ...safe].filter(Boolean) as string[];

      publish(runId, { type: 'step', tool: 'applyChange', message: 'opening PR…' });
      const prUrl = await openSchemaChangePR({
        archivedColumn: risky?.name ?? '',
        archivedRows,
        droppedColumns,
      });

      publish(runId, {
        type: 'applied',
        droppedColumns,
        archivedColumn: risky?.name ?? null,
        archivedRows,
        prUrl,
      });

      setLastRunSummary({
        prompt: ctx.prompt,
        decision,
        droppedColumns,
        archivedColumn: risky?.name ?? null,
        archivedRows,
        prUrl,
      });

      return { droppedColumns, archivedColumn: risky?.name ?? null, archivedRows, prUrl };
    },
  });

  return { inspectSchema, askHuman, applyChange };
}

function startTicker(runId: string): ReturnType<typeof setInterval> {
  const start = Date.now();
  publish(runId, { type: 'waiting', elapsedSec: 0 });
  return setInterval(() => {
    publish(runId, { type: 'waiting', elapsedSec: Math.round((Date.now() - start) / 1000) });
  }, TICK_MS);
}

function stopTicker(handle: ReturnType<typeof setInterval>) {
  clearInterval(handle);
}
