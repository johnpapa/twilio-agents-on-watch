# For agents working on this project

This is the running example app for **Twilio Agents on Watch** — the
lessons at the repo root build this code up piece by
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
  defeats the "usable in one sitting" goal of this course. See
  `server/src/twilio/messaging.ts` and lesson 02 before reintroducing SMS
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
  reality, and lesson 00's promise ("see it work before you build it")
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
no `whatsapp:` prefix. That's why lesson 03 asks for a separate voice number.

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
lesson 00, check their Node version first.

Client and server intentionally run different TypeScript versions:
`client/` stays on whatever Angular's compiler officially supports
(`~6.0.2` as of this writing), `server/` runs the latest standalone
release (`^7.0.2`). Don't force them to match.

## Angular conventions

- **Standalone components only, no NgModules.**
- **Track the latest stable Angular release** -- bumping to a new major is
  a deliberate task (read the migration guide, run `npx tsc --noEmit`, fix
  what it flags, run a full flow end to end), never a drive-by edit.
- **This client intentionally does NOT use the Single-File Component
  pattern.** `app.ts`/`app.html`/`app.css` stay split, even though the
  `twilio-demo` repo's client is a single file. This is a course teaching
  beginners Angular's component anatomy -- separate, clearly-labeled files
  for template/styles/logic are more legible to someone new to the
  framework than one large inline file. Don't "simplify" this to match the
  demo repo.

## Testing

`npm run test` (from `project/`) runs the server's unit tests --
`server/src/agent/tools.test.ts` and `server/src/hooks/ask-human-hook.test.ts`
-- plain assertion scripts run via `tsx`, not a test framework. Wired into
CI between typecheck and build.

`client/e2e/mock-flow.spec.ts` is a Playwright suite that drives a real
browser against `MOCK=1` and asserts on the live escalation UI (the step
stream, the escalation row's distinct styling, the ticker, the call
marker, the closing exchange) -- not just that components mount. Run with
`npm run e2e` from `project/`. `client/playwright.config.ts` starts both
the mock server and `ng serve` itself, and hunts for whatever chromium
build is actually on disk rather than assuming an exact revision. If you
change the UI's DOM structure or CSS class names, update the selectors in
this spec to match.

`client/playwright.shots.config.ts` + `client/e2e-shots/capture.shots.ts`
regenerate every README screenshot on demand -- run
`npx playwright test --config=playwright.shots.config.ts` from
`project/client/` whenever the escalation view changes visibly.

`.github/workflows/ci.yml` (repo root) runs `typecheck`, `test`, `build`,
and `e2e` from `project/` on every push and PR to `main`.

## Keeping things in sync -- run this checklist on every change

This app is shared with the standalone **`Twilio-demo`** repo (the live
"Nobody's Watching the Agent" demo) -- they're meant to converge, not
diverge silently. Nothing enforces that automatically.

**Any UI change** (`client/src/app/app.html`, `app.css`, or `app.ts`):
1. Update the equivalent in `twilio-demo`'s `client/src/app/app.ts` --
   same content, single-file layout there (see Angular conventions above
   and that repo's `AGENTS.md`).
2. If DOM structure or class names changed, update
   `client/e2e/mock-flow.spec.ts` selectors in **both** repos.
3. Regenerate the README screenshots (see Testing above) if the change is
   visible in them.
4. Regenerate `twilio-demo`'s `slides/demo-screenshot.png` the same way if
   the change is visible there too, then rebuild the deck.
5. Update whichever lesson's README teaches this piece of UI, per "Keeping
   `project/` and the lessons honest with each other" in the repo root's
   `AGENTS.md`.

**Any server/agent logic change** (`server/src/agent/`,
`server/src/twilio/`, etc.):
1. Propagate the same fix to the identical file in `twilio-demo`.
2. Check `server/src/mock/script.ts` still matches the real flow --
   practice mode silently drifting from reality breaks lesson 00's promise
   ("see it work before you build it").
3. Add or update a unit test and run `npm run test`.
4. Run `npm run typecheck` and `npm run e2e` before calling it done.

## Style

- TypeScript, ES modules, no build step for the server (`tsx` runs it
  directly).
- Comments explain *why*, not *what* — see the existing files for the bar.
- Small, focused commits. Don't bundle unrelated changes.
