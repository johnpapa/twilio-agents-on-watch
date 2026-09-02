# Twilio Agents for Beginners

![Levels](https://img.shields.io/badge/levels-5-8A2BE2) ![Playtime](https://img.shields.io/badge/playtime-90%20min-brightgreen) ![Waiting](https://img.shields.io/badge/waiting-zero-brightgreen) ![Boss Fight](https://img.shields.io/badge/boss%20fight-a%20real%20phone%20call-orange) ![License](https://img.shields.io/badge/license-MIT-blue)
[![CI](https://github.com/johnpapa/twilio-agents-for-beginners/actions/workflows/ci.yml/badge.svg)](https://github.com/johnpapa/twilio-agents-for-beginners/actions/workflows/ci.yml)

*Build an AI agent that texts and calls a real human when it shouldn't
decide alone. Follow it yourself, or hand each level to your coding agent
and watch it build.*

**Five levels. Ninety minutes. Zero to a real phone call.** This is a
developer journey, not a doc page: every level ends with something working
that didn't work before, and level 03 ends with your own phone ringing.

Here's a fun problem to hand an agent: teach it to know when it's in over
its head, and then teach it to actually *do* something about that — text a
person, and when nothing comes back — because the agent can't tell "still
thinking" apart from "never saw it" — try a different channel and call them.
By the end of this, you'll have built exactly that. Real texts. A real phone
that actually rings. No fake data standing in for the real thing.

![An AI agent finds that thousands of the people it is about to text are asleep, stops, and texts a human for a decision](./images/hero-escalation.png)

*The moment the whole campaign is built around. The agent works out that
thousands of the people it was told to text are asleep right now, decides
that isn't its call to make, and goes looking for a person — first by text,
then by phone.*

## Who this is for

Anyone who can follow a coding tutorial — comfortable with a terminal, has
Node.js installed — and has never touched Twilio or built an AI agent before.
Come as you are. No prior AI or Twilio experience required, just curiosity
and a phone.

*(One term you'll meet early: an agent has **tools** — functions it can decide
to call on its own. This campaign gives it one more: "go ask a human.")*

## Before you start

Only one thing is needed before Level 00, and that's on purpose — this
isn't a campaign that makes you set up five accounts before you've seen
it do anything:

- [ ] **Node ≥22.22.3, ≥24.15.0, or ≥26** — check `node -v`. That's what
      current Angular tooling requires; an older Node fails fast with a
      clear error, not a confusing one. Installing fresh? Grab **Node 24**,
      the current Active LTS.

That's it. A Twilio account, an Anthropic API key, and a phone number
(free — the one Twilio's trial account hands you automatically, nothing
to buy) all get picked up progressively, exactly at the level that needs
them (see the "Needs" column below) — not as a wall of setup before you've
written a line of code.

## The journey

**An hour and a half, one sitting, zero mandatory waiting.** That last part
isn't an accident — see [why WhatsApp instead of SMS](#texting-runs-over-whatsapp-not-sms)
below. Nothing here makes you sit around for a week waiting on a carrier
before you get to see your work actually do something.

Two of the five levels are setup you only ever do once. The other three are
the build.

| | Level | Time | | Needs |
|---|---|---|---|---|
| 🎬 | [00 — Run the Demo](./00-run-the-demo/) | ~15 min | *setup* | Nothing — `npm run practice` |
| 🧩 | [01 — Build the Escalation Ladder](./01-build-the-escalation-ladder/) | ~20 min | **build** | Nothing — plain Node.js |
| 💬 | [02 — Send and Receive Real Texts](./02-send-and-receive-real-texts/) | ~25 min | *setup* | Free Twilio account — the only Console trip |
| 👑 | [03 — Place a Real Call](./03-place-a-real-call/) — **boss level** | ~10 min | **build** | Nothing new — set up in level 02 |
| 📡 | [04 — Stay Reachable After the Call](./04-stay-reachable-after-the-call/) | ~20 min | **build** | Nothing — model key is a side quest |

Level 00 is `npm install` and watching it work. Level 02 is signing up for
Twilio and collecting credentials — all of it in one Console visit,
including the phone number level 03 needs, so you're never sent back. Do
those once and they're done forever: start a second project with this stack
and you begin at level 01.

Levels 01, 03 and 04 are the actual building, and none of them asks you for
another account.

**Nothing here costs money.** The Twilio trial is free, and level 04 runs
without a model key — real texts, a real call, a real answer to a follow-up.
Adding a key is a clearly-marked **side quest** at the end of that level, not
a step: it changes exactly one thing, whether the decision to escalate is
made by a model or by an `if`, and the app shows you which one you're
running.

Start at level 00 and work through in order — each one builds on the
last, and level 04 ends with your own phone ringing because of code you
wrote. Clear level 03 and the hard part is behind you — the rest is the
victory lap.

Cleared every level? Run `npm run status --prefix project` for your
scorecard.

## Controls

| Command | What it does |
|---|---|
| `npm run practice` | Run the whole campaign scripted — no credentials, safe to replay as many times as you want |
| `npm start` | Run it for real — actual texts, actual phone calls |
| `npm run status --prefix project` | Check your scorecard — which levels are cleared so far |

## Built with Twilio's own Skills

This campaign, and the app it teaches you to build, were built using
[Twilio's own Skills](https://github.com/twilio/ai) — the SKILL.md content
behind their `twilio-developer-kit` plugin
([docs](https://www.twilio.com/docs/ai/skills)), launched in public beta
May 2026 alongside the [Twilio MCP server](https://www.twilio.com/docs/ai/mcp).
Both live in [`github.com/twilio/ai`](https://github.com/twilio/ai) — 66
skills under `skills/twilio/`, and the MCP under `mcp/`. Concretely, here's
what that bought:

- **The auth pattern was checked against `twilio-security-api-auth`**,
  which states plainly that Auth Tokens in production code are "the most
  common credential leak" and API Key + Secret is the production standard.
  Our code already did this — confirmed, not guessed.
- **The outbound call pattern was checked against
  `twilio-voice-outbound-calls`**, and matched their own documented example
  almost line for line. It also caught two things we'd have shipped
  without noticing: outbound calls are only permitted between 8am and 9pm in
  the recipient's local time, and need real consent/TCPA handling. Neither was in our
  code before this check — now it's a documented weak point instead of a
  silent gap. See level 03.
- **The WhatsApp send pattern was checked against
  `twilio-whatsapp-send-message`**, which is where the Sandbox's real
  throughput limits (1 message/second, 50/day on trial accounts, a 72-hour
  join expiry) came from — now documented instead of discovered the hard
  way mid-demo.
- **A genuinely fun surprise**: getting this value didn't require
  installing anything. Twilio publishes the Skills as plain public
  markdown files (`github.com/twilio/ai`), so a coding agent — or a human —
  can pull exactly the skill it needs and read it directly, no plugin
  install, no setup step.

**What this pass used, precisely:** the Skills content, read straight from
the repo. *Not* the MCP server's `twilio__search` / `twilio__retrieve`
tools, which search Twilio's full API surface (1,800+ operations across 30+
products). This app touches three well-documented endpoints the Skills
already cover verbatim, so the MCP had nothing to add here — but it's the
right tool the moment you reach for an API you don't already know. Worth
knowing which one actually did the work.

**Try this yourself** — it's a genuine speedup, not a footnote. Both are
free, and neither needs a Twilio account or an API key; the MCP is a hosted
endpoint with no auth at all:

```bash
# Skills + MCP together, in Claude Code:
/plugins   →  search "twilio-developer-kit"

# or just the docs MCP, one line:
claude mcp add twilio-docs -- npx -y @anthropic-ai/mcp-remote https://mcp.twilio.com/docs
```

Works across Claude Code, Cursor, Codex, and anything supporting the Agent
Skills standard. Either way you get code checked against Twilio's own
guidance instead of code you guessed at. Start here:

- Skills + MCP source: [github.com/twilio/ai](https://github.com/twilio/ai)
- Skills docs: [twilio.com/docs/ai/skills](https://www.twilio.com/docs/ai/skills)
- MCP docs: [twilio.com/docs/ai/mcp](https://www.twilio.com/docs/ai/mcp)
- Announcement: [Introducing the Twilio MCP Server and Skills](https://www.twilio.com/en-us/blog/developers/introducing-twilio-mcp-skills)

See `project/AGENTS.md` for the full validation notes.

## Texting runs over WhatsApp, not SMS

US SMS over a normal phone number requires A2P 10DLC carrier registration,
which currently takes anywhere from minutes to over a week to approve.
That's incompatible with "finish this in one sitting," so levels 02 and
04 use the Twilio WhatsApp Sandbox instead — real messages, free, working
in minutes. [Where to go next](#where-to-go-next) covers what changes for a
production sender.

## Where to go next

Everything here runs on free, fast, prototyping-grade Twilio tools by
design, so the whole thing fits in one sitting. A real product needs a few
things this campaign deliberately skipped. This isn't a lesson — it's the
map of what you'd tackle after it.

**A registered sender.** The WhatsApp Sandbox is exactly right for what it
was used for here: fast, free, real. Production wants either a verified
WhatsApp Business sender — your own number, your own brand, no shared
sandbox, no 72-hour rejoin — or SMS over a real 10-digit number, which
brings back **A2P 10DLC**. US carriers require brand and campaign
registration before they'll deliver application-to-person traffic, and
unregistered messages are filtered *silently*: the API still reports
success, the message just never arrives. Registration takes anywhere from
minutes to over a week. Either path is a real setup project, not a config
flag.

**Receiving messages at scale.** `listInboundSince()` polls Twilio's
message list. That's the right call for one human and a five-minute window
and the wrong one for real traffic. Production moves to a webhook — a
public URL Twilio calls the instant a message arrives — once there's a
stable place to host one, and swaps the in-memory `handledSids` set for a
real datastore.

**The honest list of what else is missing.** No audit trail, no
timeout/backoff policy, no rate limiting or spend cap on the public number,
no real TCPA consent tracking for calls. None of these are hard. All of
them are real, and a production system needs an actual answer to each one
rather than a demo-grade shrug. If you did the stretch goal in level 04,
you've already started.

Actually teaching that setup is out of scope here. If there's enough
interest it's a natural follow-up — same format, same one-sitting
philosophy, aimed at taking this from Sandbox to shipped.

## The project

Every level builds on [`project/`](./project/) — a real Angular +
Node/Express app, not a toy. By the end of level 04 it's the same code
behind the live "Nobody's Watching the Agent" demo. Read `project/AGENTS.md`
before making structural changes to it.

## License

MIT. Build something with it, break something with it, fork it and make it
weirder — that's the whole point.
