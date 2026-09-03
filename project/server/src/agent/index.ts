import { streamText, generateText, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { buildTools, type RunContext } from './tools.js';
import { publish } from '../sse.js';
import { getLastRunSummary } from './context.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

const SYSTEM_PROMPT = `You are an agent that sends customer notifications. You have three tools: checkAudience, askHuman, sendTheNotice.

Workflow:
1. Always call checkAudience first.
2. If anyone would receive the message in the middle of their night, that is NOT yours to decide. Call askHuman, saying plainly how many people are asleep right now and asking whether to send anyway or hold them until morning. Say the number of people as a plain number, not with a comma ("4136", not "4,136") -- it gets read aloud, and the comma is misread as a pause.
3. If nobody is in the quiet window, no human is needed.
4. askHuman places a real text and, if unanswered, a real phone call -- call it AT MOST ONCE. If it fails or times out, do not call it again for any reason; report the run as unresolved and stop.
5. Once you have a human decision (or none was needed), call sendTheNotice with that decision.
6. Keep any narration brief -- the tool calls carry the story, not your prose.`;

export async function runAgent(runId: string, prompt: string): Promise<string> {
  const ctx: RunContext = { prompt, audience: null, lastDecision: null };
  const tools = buildTools(runId, ctx);

  publish(runId, { type: 'run-start', prompt });

  try {
    const result = streamText({
      model: anthropic(MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      tools,
      stopWhen: stepCountIs(8),
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'tool-call':
          publish(runId, { type: 'tool-call', tool: part.toolName, args: part.input });
          break;
        case 'tool-result':
          publish(runId, { type: 'tool-result', tool: part.toolName, result: part.output });
          break;
        case 'text-delta':
          publish(runId, { type: 'text', delta: part.text });
          break;
        case 'error':
          publish(runId, { type: 'error', message: String(part.error) });
          break;
      }
    }

    const finalText = await result.text;
    publish(runId, { type: 'done', text: finalText });
    return finalText;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    publish(runId, { type: 'error', message });
    throw err;
  }
}

/** True when there's no model key, so every path has to work without one. */
export function hasModelKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * The follow-up answer, assembled from the run summary instead of generated.
 *
 * Not as good -- it can only answer the question the demo was built around,
 * and it says so when asked anything else. But it's real numbers from a real
 * run, and it costs nothing.
 */
function templatedFollowUp(): string {
  const s = getLastRunSummary();
  if (!s) return "I haven't sent anything yet, so there's nothing to explain.";
  if (!s.heldUntilMorning) {
    return `You said "${s.decision}", so all ${s.total.toLocaleString()} of them got it straight away.`;
  }
  return (
    `${s.scheduled.toLocaleString()} of them are between ${s.quietWindow} local right now, so I held those ` +
    `and sent to the ${s.sentNow.toLocaleString()} who were awake. You said "${s.decision}". ` +
    `The rest go out at 8am their time.`
  );
}

/**
 * Used for the closing beat and the "stay reachable" background poller:
 * a plain text-in, text-out answer grounded in the last run's summary.
 * No tools -- this is Q&A about what already happened, not a new task.
 */
export async function answerFollowUp(question: string): Promise<string> {
  if (!hasModelKey()) return templatedFollowUp();

  const summary = getLastRunSummary();
  const context = summary
    ? `Here is exactly what you did in the live demo, as structured facts:\n${JSON.stringify(summary, null, 2)}`
    : `You haven't run the demo task yet in this session -- you have no prior action to report on.`;

  const { text } = await generateText({
    model: anthropic(MODEL),
    system:
      'You are the same agent from a live demo, still reachable by text after the fact. Reply in 1-3 short sentences, plain text, no markdown, grounded strictly in the facts given. If you cannot answer from the given facts, say so honestly.',
    prompt: `${context}\n\nIncoming text message: "${question}"\n\nReply text:`,
  });
  return text.trim();
}
