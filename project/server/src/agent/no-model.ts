import { buildTools, type RunContext } from './tools.js';
import { buildEscalationQuestion } from './question.js';
import { publish } from '../sse.js';

/**
 * The same run, with the model's judgement replaced by an `if`.
 *
 * This exists so nobody has to buy anything to finish the campaign. Every
 * Twilio call here is real -- the WhatsApp message, the wait, the phone call,
 * the reply -- because it runs the exact same tools the model would have
 * called. What's missing is the part where the agent *decides* to escalate:
 * here that decision is this file's `if (slice.asleep > 0)`.
 *
 * That difference is the whole point of the level, so the UI says so rather
 * than quietly pretending otherwise.
 */
/**
 * The SDK types a tool result as `AsyncIterable<T> | T` because tools *may*
 * stream. None of ours do -- they all return a plain object -- so narrow it
 * once here rather than at every call site.
 */
function value<T>(result: AsyncIterable<T> | T): T {
  return result as T;
}

/**
 * The SDK hands every tool a call-options object. None of our tools read any
 * of it, so this stands in for the one the model's loop would have supplied.
 * Typed off the real signature so it can't drift if the SDK changes shape.
 */
const NO_MODEL_CALL = { toolCallId: 'no-model', messages: [], context: {} } as Parameters<
  NonNullable<ReturnType<typeof buildTools>['checkAudience']['execute']>
>[1];

export async function runWithoutModel(runId: string, prompt: string): Promise<string> {
  const ctx: RunContext = { prompt, audience: null, lastDecision: null };
  const tools = buildTools(runId, ctx);

  publish(runId, { type: 'run-start', prompt, noModel: true });

  const slice = value(
    await tools.checkAudience.execute!({}, NO_MODEL_CALL),
  );

  let decision = 'send all';
  if (slice.asleep > 0) {
    const question = buildEscalationQuestion(slice);

    publish(runId, { type: 'tool-call', tool: 'askHuman', args: { question } });
    const answer = value(
      await tools.askHuman.execute!({ question }, NO_MODEL_CALL),
    );
    decision = answer.decision;
  }

  publish(runId, { type: 'tool-call', tool: 'sendTheNotice', args: { decision } });
  const result = value(
    await tools.sendTheNotice.execute!({ decision }, NO_MODEL_CALL),
  );

  const text =
    result.scheduled > 0
      ? `Sent to ${result.sentNow.toLocaleString()} now, holding ${result.scheduled.toLocaleString()} until morning.`
      : `Sent to all ${result.sentNow.toLocaleString()} now.`;
  publish(runId, { type: 'done', text });
  return text;
}
