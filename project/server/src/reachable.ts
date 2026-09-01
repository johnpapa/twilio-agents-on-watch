import { listInboundSince, sendMessage } from './twilio/messaging.js';
import { answerFollowUp } from './agent/index.js';
import { publish } from './sse.js';

const POLL_INTERVAL_MS = 4000;
const handledSids = new Set<string>();

let activeRunId: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

/** The stream that inbound closing-beat exchanges get mirrored onto, if any. */
export function setActiveRunId(runId: string | null) {
  activeRunId = runId;
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
