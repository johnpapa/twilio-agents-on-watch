#!/usr/bin/env -S npx tsx
/**
 * The demo's escalation, as a Claude Code hook.
 *
 * The app in this repo is a custom agent: we own the loop, so `askHuman` is
 * just a tool. This file is the same idea pointed at a coding agent you did
 * not write. Claude Code fires `PreToolUse` before a tool call runs and lets
 * the hook decide whether it proceeds -- so the hook can text you, wait, and
 * hand your answer back as the decision. The agent keeps going instead of
 * blocking on a terminal nobody is watching.
 *
 * Wire it up in .claude/settings.json:
 *
 *   {
 *     "hooks": {
 *       "PreToolUse": [
 *         {
 *           "matcher": "Bash",
 *           "hooks": [
 *             { "type": "command",
 *               "command": "npx tsx /abs/path/to/server/src/hooks/ask-human-hook.ts" }
 *           ]
 *         }
 *       ]
 *     }
 *   }
 *
 * Needs the same .env as the demo (Twilio API key + secret, the WhatsApp
 * sandbox joined from PRESENTER_PHONE_NUMBER).
 *
 * NOT WIRED INTO THE FIVE-MINUTE DEMO, on purpose -- see hooks/README.md for
 * why the live demo stays a custom agent.
 */
import '../env.js';
import { sendMessage, pollForReply } from '../twilio/messaging.js';
import { placeEscalationCall } from '../twilio/voice.js';
import { PRESENTER_NUMBER } from '../twilio/client.js';

/** How long to wait for a text reply before escalating to a call. */
const WAIT_MS = Number(process.env.HOOK_WAIT_MS ?? 120_000);
/** How long to wait after the call before giving up and handing control back. */
const POST_CALL_WAIT_MS = Number(process.env.HOOK_POST_CALL_WAIT_MS ?? 120_000);

export type Decision = 'allow' | 'deny' | 'ask';

/**
 * Map a free-text reply to a permission decision.
 *
 * Deliberately conservative: anything that isn't a recognisable yes becomes
 * `deny`, and silence becomes `ask` (falls back to Claude Code's normal
 * prompt) rather than `allow`. A hook that fails open would be a very
 * expensive bug.
 */
export function decisionFromReply(reply: string | null | undefined): Decision {
  if (!reply) return 'ask';
  const text = reply.trim().toLowerCase();
  if (/^(y|yes|yep|yeah|ok|okay|go|do it|approve[d]?|allow|ship it)\b/.test(text)) {
    return 'allow';
  }
  if (/^(n|no|nope|stop|don'?t|deny|reject|cancel|abort)\b/.test(text)) {
    return 'deny';
  }
  return 'deny';
}

/** One-line summary of what the agent wants to do, for the text body. */
export function describeToolCall(toolName: string, toolInput: unknown): string {
  if (toolInput && typeof toolInput === 'object') {
    const input = toolInput as Record<string, unknown>;
    const detail = input.command ?? input.file_path ?? input.path ?? input.url;
    if (typeof detail === 'string') {
      const trimmed = detail.length > 300 ? `${detail.slice(0, 300)}…` : detail;
      return `${toolName}: ${trimmed}`;
    }
  }
  return toolName;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function emit(decision: Decision, reason: string): void {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }),
  );
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const event = JSON.parse(raw) as { tool_name?: string; tool_input?: unknown };
  const what = describeToolCall(event.tool_name ?? 'a tool', event.tool_input);

  const to = PRESENTER_NUMBER();
  const question = `Your agent wants to run: ${what}. Reply yes or no.`;
  const sentAt = new Date();
  await sendMessage(to, `Your agent wants to run:\n\n${what}\n\nReply "yes" or "no".`);

  let reply = await pollForReply({
    from: to,
    since: sentAt,
    timeoutMs: WAIT_MS,
    intervalMs: 2500,
    onTick: () => {},
  });

  // Same second rung as the demo agent: silence is ambiguous, so try the other
  // channel rather than deciding on the human's behalf. Without this the hook
  // was only the first rung of the ladder, which is not what the talk claims.
  let via = 'text';
  if (!reply) {
    await placeEscalationCall(to, question);
    via = 'a phone call';
    reply = await pollForReply({
      from: to,
      since: sentAt,
      timeoutMs: POST_CALL_WAIT_MS,
      intervalMs: 2500,
      onTick: () => {},
    });
  }

  const decision = decisionFromReply(reply?.body);
  if (decision === 'ask') {
    emit('ask', 'No reply to the text or the call -- falling back to the normal prompt.');
    return;
  }
  emit(decision, `Human replied "${reply?.body?.trim()}" after ${via}.`);
}

// Never take the agent down. A broken hook should hand control back to the
// normal permission prompt, not crash the session or silently allow.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  main().catch((err) => {
    emit('ask', `Escalation hook failed (${err instanceof Error ? err.message : err}).`);
  });
}
