import { tool } from 'ai';
import { z } from 'zod';
import { inspectAudience, sendNotice, type AudienceSlice } from '../db.js';
import { sendMessage, pollForReply } from '../twilio/messaging.js';
import { placeEscalationCall } from '../twilio/voice.js';
import { publish } from '../sse.js';
import { PRESENTER_NUMBER } from '../twilio/client.js';
import { setLastRunSummary } from './context.js';
import { setAwaitingDecisionFrom } from '../reachable.js';

// Both are demo pacing, not protocol limits -- twenty seconds is nothing in
// real life, but it's what keeps a five-minute talk on schedule. Override
// either one via .env if you're rehearsing at a different pace or taking
// this to an audience that needs longer.
const TEXT_REPLY_TIMEOUT_MS = process.env.TEXT_REPLY_TIMEOUT_MS
  ? Number(process.env.TEXT_REPLY_TIMEOUT_MS)
  : 20_000;
const CALL_REPLY_TIMEOUT_MS = process.env.CALL_REPLY_TIMEOUT_MS
  ? Number(process.env.CALL_REPLY_TIMEOUT_MS)
  : 90_000;
const TICK_MS = 1_000;

export interface RunContext {
  prompt: string;
  audience: AudienceSlice | null;
  lastDecision: string | null;
}

const NEGATES_HOLD = /\b(don'?t|do not|no need to|skip|forget)\s+(hold|wait)\b/i;
const SEND_WORDS =
  /\b(all|everyone|now|send it|send all|send them|go ahead|go for it|go|blast|do it|ship it|proceed|fire away|push it out)\b/i;
const HOLD_WORDS =
  /\b(hold|wait|morning|later|queue|schedule|delay|keep them|pause|hang on|hang tight|let them sleep|not yet|don'?t wake)\b/i;

/**
 * A real reply is casual ("nah let it wait", "go for it", "keep them till
 * morning is fine"), not one of the two exact phrases the SMS prompt
 * suggests -- found on a real run where natural phrasings needed to work,
 * not just an exact match. `NEGATES_HOLD` exists because "hold" words are
 * broad enough that a literal "don't hold them, send now" would otherwise
 * match on the word "hold" alone and do the opposite of what was said.
 * Ambiguous or unrecognised text defaults to holding: waking people is the
 * mistake that can't be undone, a few hours' delay is.
 */
export function wantsToHold(decision: string): boolean {
  if (NEGATES_HOLD.test(decision)) return false;
  const saysSend = SEND_WORDS.test(decision);
  const saysHold = HOLD_WORDS.test(decision);
  return !(saysSend && !saysHold);
}

export function buildTools(runId: string, ctx: RunContext) {
  // askHuman places a real text and, on silence, a real billed call -- if it
  // times out and throws, nothing stops a model-driven run from just calling
  // it again on the next step, starting a brand new poll window from a brand
  // new timestamp. Any reply sent in between is now "in the past" relative to
  // that new window and is silently missed, while the phone rings again.
  // Found on a real run: repeated calls, texted replies going nowhere. One
  // escalation attempt per run, enforced here rather than left to the model's
  // judgement.
  let askHumanCalled = false;

  const checkAudience = tool({
    description:
      'Find everyone affected by the outage and work out what the local time is for each of them right now.',
    inputSchema: z.object({}),
    execute: async () => {
      const step = (message: string, extra: Record<string, unknown> = {}) =>
        publish(runId, { type: 'step', tool: 'checkAudience', message, ...extra });

      step('pulling the list of affected customers…');
      const slice = inspectAudience();
      ctx.audience = slice;

      step(`${slice.total.toLocaleString()} customers were affected`);
      step('checking what time it is where each of them lives…');
      step(`${slice.awake.toLocaleString()} are awake right now — fine to text`);

      // The whole demo turns on this line. It is a judgement call, not a
      // rule the code can settle: the agent knows *that* it would wake
      // people, but not whether this outage is worth waking them for.
      step(
        `${slice.asleep.toLocaleString()} are between ${slice.quietWindow} where they live — ` +
          `that's a judgement call, asking a human`,
        { severity: 'irreversible' },
      );

      return slice;
    },
  });

  const askHuman = tool({
    description:
      'Escalate a decision to a human that the agent should not make alone: text first, and if unanswered, call and speak the question. Returns the human decision as text.',
    inputSchema: z.object({
      question: z.string().describe('The question to ask the human, in plain language.'),
    }),
    execute: async ({ question }) => {
      if (askHumanCalled) {
        throw new Error(
          'askHuman already ran once this run. This demo escalates a decision exactly once -- ' +
            'do not call askHuman again. Report the run as unresolved and stop.',
        );
      }
      askHumanCalled = true;

      const to = PRESENTER_NUMBER();
      const messageBody = `${question} Reply "hold them" or "send all".`;

      publish(runId, { type: 'message-sent', to, body: messageBody });
      const sentAt = new Date();
      // Claim this number until we have an answer, so the stay-reachable
      // poller doesn't treat the decision as a fresh question and reply to it.
      setAwaitingDecisionFrom(to);
      await sendMessage(to, messageBody);

      let ticker = startTicker(runId);
      let reply = await pollForReply({
        from: to,
        since: sentAt,
        timeoutMs: TEXT_REPLY_TIMEOUT_MS,
        intervalMs: 2000,
        onTick: () => {},
      });
      stopTicker(ticker);

      if (reply) {
        setAwaitingDecisionFrom(null);
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
        timeoutMs: CALL_REPLY_TIMEOUT_MS,
        intervalMs: 2500,
        onTick: () => {},
      });
      stopTicker(ticker);

      setAwaitingDecisionFrom(null);

      if (!reply) {
        publish(runId, { type: 'error', message: 'no reply received after voice escalation' });
        throw new Error('No human response received after voice escalation.');
      }

      publish(runId, { type: 'reply', text: reply.body, via: 'whatsapp-after-call' });
      return { decision: reply.body, via: 'whatsapp-after-call' };
    },
  });

  const sendTheNotice = tool({
    description:
      'Send the outage notice, following the human decision about whether to hold the overnight recipients until morning.',
    inputSchema: z.object({
      decision: z.string().describe('The human decision, e.g. "hold them" or "send all".'),
    }),
    execute: async ({ decision }) => {
      const slice = ctx.audience;
      if (!slice) throw new Error('sendTheNotice called before checkAudience.');

      const step = (message: string) =>
        publish(runId, { type: 'step', tool: 'sendTheNotice', message });

      const hold = wantsToHold(decision);

      if (hold) {
        step(`sending to the ${slice.awake.toLocaleString()} people who are awake…`);
        step(`holding ${slice.asleep.toLocaleString()} until 8am their time`);
      } else {
        step(`sending to all ${slice.total.toLocaleString()} now, per the human`);
      }

      const result = sendNotice(hold, 'human-on-the-phone');

      publish(runId, {
        type: 'applied',
        sentNow: result.sentNow,
        scheduled: result.scheduled,
        held: hold,
      });

      setLastRunSummary({
        prompt: ctx.prompt,
        decision,
        total: slice.total,
        sentNow: result.sentNow,
        scheduled: result.scheduled,
        quietWindow: slice.quietWindow,
        heldUntilMorning: hold,
      });

      return result;
    },
  });

  return { checkAudience, askHuman, sendTheNotice };
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
