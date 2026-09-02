# The same escalation, as a Claude Code hook

`ask-human-hook.ts` is the demo's `askHuman` tool pointed at a coding agent
you didn't write. Claude Code fires `PreToolUse` before a tool call runs and
lets the hook decide whether it proceeds — so the hook texts you, waits, and
returns your answer as the permission decision.

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /srv/data"}}' \
  | npx tsx src/hooks/ask-human-hook.ts
```

Wire it up in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command",
            "command": "npx tsx /abs/path/to/server/src/hooks/ask-human-hook.ts" }
        ]
      }
    ]
  }
}
```

Uses the same `.env` as the demo. `HOOK_WAIT_MS` sets the wait before the call
(default 120s), `HOOK_POST_CALL_WAIT_MS` the wait after it (default 120s).

**Nothing in the demo imports this file.** `npm start` and `npm run practice`
both run the custom agent in `server/src/agent/`. What the two share is the
Twilio plumbing underneath — `sendMessage`, `pollForReply` and
`placeEscalationCall` are one implementation, imported by both — so this is
the same ladder reached through a different door, not a second copy of it.

## Why the live demo is still a custom agent

This file exists to make a point concrete, **not** to replace the demo. For a
five-minute talk the custom agent wins on four counts:

- **Determinism.** The agent hits the escalation on cue, every run. A hook
  demo needs Claude Code to want permission for the right thing at the right
  moment inside a two-minute window — you'd be hoping, on stage.
- **Legibility.** Two panes with a live step stream read from the back of a
  room. A terminal does not.
- **A rehearsal mode and a backup video**, both of which only exist because
  we own the loop.
- **It shows the primitives.** The slides can put the seven lines of
  escalation on screen because there's a loop to point at.

The hook is the better answer to *"where would I actually use this?"* — which
is a question for the Q&A, not a reason to rebuild the demo. Point at this
file; don't spend stage time on it.

The third shape, and the most portable, is an **MCP server** exposing
`askHuman` as a tool: then Claude Code, Cursor, and Codex all get human
escalation without any of them needing a bespoke hook. That's the version
worth pitching as a product.

## What's tested

`ask-human-hook.test.ts` (`npx tsx src/hooks/ask-human-hook.test.ts`) covers
the decision logic, which is the part that would be expensive to get wrong:
an ambiguous reply resolves to `deny`, and no reply at all resolves to `ask`
so Claude Code falls back to its normal prompt. It never fails open. A thrown
error returns `ask` too, rather than crashing the agent session.

**Not tested:** the Twilio round trip and a live Claude Code invocation. Both
need real credentials and a real agent session. The JSON contract has been
exercised by piping a `PreToolUse` payload in, but nobody has yet watched
this approve a real tool call from a phone.
