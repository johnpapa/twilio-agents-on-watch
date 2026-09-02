import { listInboundSince, sendMessage } from './twilio/messaging.js';
import { answerFollowUp } from './agent/index.js';
import { getLastRunSummary } from './agent/context.js';
import { publish } from './sse.js';

const POLL_INTERVAL_MS = 4000;
const handledSids = new Set<string>();

let activeRunId: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let awaitingDecisionFrom: string | null = null;

/** The stream that inbound closing-beat exchanges get mirrored onto, if any. */
export function setActiveRunId(runId: string | null) {
  activeRunId = runId;
}

/**
 * Tell the poller that a run is currently waiting on this number to answer a
 * question. Both this poller and askHuman's own poll read the same inbound
 * messages, so without this the human's decision ("hold them") gets picked up
 * twice: once to continue the run, and once here as if it were an unrelated
 * question. The run hasn't finished at that point, so the answer came back
 * from an empty summary -- the agent would text "you haven't run the demo
 * yet" seconds after you told it what to do, live, on stage.
 */
export function setAwaitingDecisionFrom(number: string | null) {
  awaitingDecisionFrom = number;
}

/**
 * Background poller over ALL inbound WhatsApp messages to the sandbox
 * number, not just replies during a live run. Anyone who's joined the
 * sandbox can text it after the demo and get a real answer. No webhook --
 * same reason as the rest of this app: polling is simple, visible, and
 * needs no public URL.
 */
export function startReachablePoller() {
  if (timer) return;
  let since = new Date();

  timer = setInterval(async () => {
    try {
      const messages = await listInboundSince(since);
      for (const msg of messages) {
        if (handledSids.has(msg.sid)) continue;
        handledSids.add(msg.sid);
        if (msg.dateSent > since) since = msg.dateSent;

        // The run is mid-flight and this is the answer it asked for. Leave it
        // to askHuman; replying here would talk over the demo.
        if (awaitingDecisionFrom && msg.from === awaitingDecisionFrom) continue;

        // Nothing has run yet, so there is nothing to be reachable *about*.
        // Answering here would only produce "I haven't done anything yet".
        if (!getLastRunSummary()) continue;

        if (activeRunId) {
          publish(activeRunId, { type: 'closing-question', from: msg.from, text: msg.body });
        }

        const reply = await answerFollowUp(msg.body);
        await sendMessage(msg.from, reply);

        if (activeRunId) {
          publish(activeRunId, { type: 'closing-answer', to: msg.from, text: reply });
        }
      }
    } catch (err) {
      console.error('[reachable-poller]', err instanceof Error ? err.message : err);
    }
  }, POLL_INTERVAL_MS);

  console.log('[reachable-poller] started -- watching all inbound WhatsApp messages to the sandbox number');
}

export function stopReachablePoller() {
  if (timer) clearInterval(timer);
  timer = null;
}
