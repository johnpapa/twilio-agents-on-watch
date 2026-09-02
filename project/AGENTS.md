# For agents working on this project

This is the running example app for the **Twilio Agents for Beginners**
campaign — the levels at the repo root build this code up piece by
piece. It's also, unmodified, the same app behind the live "Nobody's
Watching the Agent" demo. They're meant to converge; changes here should
make sense in both contexts.

## Conventions that matter

- **The demo DB reseeds on every `/api/run` call**, not just on server boot
  (`server/src/index.ts` calls `initDb()` per-run). This was a deliberate
  fix: without it, a second run in the same server session would find the
  columns already dropped from the first run and silently diverge from the
  script. Don't revert to boot-only seeding.
- **Texting runs over the Twilio WhatsApp Sandbox**, not SMS over a
  registered number. This was also deliberate — real US SMS requires A2P
  10DLC brand/campaign registration that can take days to approve, which
  defeats the "usable in one sitting" goal of this campaign. See
  `server/src/twilio/messaging.ts` and level 02 before reintroducing SMS
  as the default path. If you're adding a production-SMS option, make it
  additive ("where to go next" territory), not a replacement of the default.
- **No webhooks anywhere in this app**, by design — inbound messages are
  polled (`listInboundSince` in `messaging.ts`), and voice calls speak via
  inline TwiML rather than `<Gather>`. This keeps the whole thing runnable
  with no public URL and nothing to misconfigure. Don't introduce a webhook
  without discussing the tradeoff first.
- **`MOCK=1` must stay a faithful stand-in.** It runs the real database
  operations (`inspectAudience`, `sendNotice`) against the real seeded SQLite
  db, and the quiet-hours split is computed from the actual clock — only the
  model calls and Twilio calls are scripted. If you change the real flow's shape, update
  `server/src/mock/script.ts` to match, or practice mode silently drifts from
  reality, and level 00's promise ("see it work before you build it")
  breaks.

## Twilio integration — validation status

The Twilio integration (`server/src/twilio/`) was cross-checked against
Twilio's own Skills content — the same SKILL.md files the
`twilio-developer-kit` plugin (their MCP server + Skills, launched in
public beta May 2026) installs, fetched directly from their public source
(`github.com/twilio/ai`, under `skills/twilio/` — 66 skills as of this
writing). Checked against `twilio-security-api-auth`,
`twilio-whatsapp-send-message`, `twilio-voice-twiml`, and
`twilio-voice-outbound-calls`. See the repo root's `README.md` ("Built with
Twilio's own Skills") for the specifics and what it caught.

**The MCP server has been used once, on the question the Skills don't
answer:** does the escalation call go over WhatsApp like the text does?
`twilio__search` settled it — **no**. The text is WhatsApp; the call is an
ordinary PSTN call from `TWILIO_VOICE_NUMBER` to a plain E.164 number, with
no `whatsapp:` prefix. That's why level 03 asks for a separate voice number.

WhatsApp Business Calling does exist, but it needs a voice-enabled WhatsApp
sender, Meta business verification at 2,000 business-initiated
conversations/24h, per-user call permission granted in advance, and it can't
bridge to PSTN. A trial account has none of that. So the two-network split
isn't a workaround — it's the only path, and it's worth teaching as one.

Don't "simplify" this by moving the call onto WhatsApp.

## Dependency versions

Everything is pinned to the latest *stable* release as of this writing --
Angular 22 (client), and on the server: `ai` 7, `@ai-sdk/anthropic` 4,
Express 5, Twilio SDK 6, Zod 4, TypeScript 7. All three -- `ai`, Express, and
Twilio -- had real breaking API changes crossing those majors (`tool()`'s
`parameters` became `inputSchema`, `part.args`/`part.result`/`part.textDelta`
became `part.input`/`part.output`/`part.text`, `maxSteps` became
`stopWhen: stepCountIs(n)`); this isn't a version bump you can do blindly by
editing package.json. When bumping further: change the version, run
`npx tsc --noEmit`, fix what it flags (TypeScript catches nearly all of it),
then run a full mock-mode flow end to end before trusting it.

Angular 22's tooling requires **Node ^22.22.3 || ^24.15.0 || >=26.0.0** --
notably *not* satisfied by a Node install one patch version behind
(22.22.2 fails). If a learner reports `ng` commands failing mysteriously in
level 00, check their Node version first.

Client and server intentionally run different TypeScript versions:
`client/` stays on whatever Angular's compiler officially supports
(`~6.0.2` as of this writing), `server/` runs the latest standalone
release (`^7.0.2`). Don't force them to match.

## Testing

`client/e2e/mock-flow.spec.ts` is a Playwright suite that drives a real
browser against `MOCK=1` and asserts on the live escalation UI (the step
stream, the escalation row's distinct styling, the ticker, the call
marker, the closing exchange) -- not just that components mount. Run with
`npm run e2e` from `project/`. `client/playwright.config.ts` starts both
the mock server and `ng serve` itself, and hunts for whatever chromium
build is actually on disk rather than assuming an exact revision. If you
change the UI's DOM structure or CSS class names, update the selectors in
this spec to match.

`.github/workflows/ci.yml` (repo root) runs `typecheck`, `build`, and
`e2e` from `project/` on every push and PR to `main`.

## Style

- TypeScript, ES modules, no build step for the server (`tsx` runs it
  directly).
- Comments explain *why*, not *what* — see the existing files for the bar.
- Small, focused commits. Don't bundle unrelated changes.
