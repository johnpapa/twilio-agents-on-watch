# Twilio Agents for Beginners

*Build an AI agent that texts and calls a real human when it shouldn't
decide alone. Follow it yourself, or hand each chapter to your coding agent
and watch it build.*

Here's a fun problem to hand an agent: teach it to know when it's in over
its head, and then teach it to actually *do* something about that — text a
person, and if that gets ignored (it will — everyone ignores a text), call
them. By the end of this, you'll have built exactly that. Real texts. A
real phone that actually rings. No fake data standing in for the real
thing.

It's not trying to replace [TwilioQuest](https://www.twilio.com/quest) —
think of it as the sequel nobody's written yet: what happens when the thing
writing the code is also an agent.

## Who this is for

Anyone who can follow a coding tutorial — comfortable with a terminal, has
Node.js installed — and has never touched Twilio or built an agent with
tool-calling before. Come as you are. No prior AI or Twilio experience
required, just curiosity and a phone.

## How long this takes

**Under 2 hours, one sitting, zero mandatory waiting.** That last part
isn't an accident — see [why WhatsApp instead of SMS](#texting-runs-over-whatsapp-not-sms)
below. Nothing here makes you sit around for a week waiting on a carrier
before you get to see your work actually do something.

| Chapter | Time | Needs |
|---|---|---|
| [00 — Run the Demo](./00-run-the-demo/) | ~15 min | Nothing — `npm run mock` |
| [01 — Build the Escalation Ladder](./01-build-the-escalation-ladder/) | ~20 min | Nothing — plain Node.js |
| [02 — Send and Receive Real Texts](./02-send-and-receive-real-texts/) | ~15-20 min | Free Twilio account |
| [03 — Place a Real Call](./03-place-a-real-call/) | ~15-20 min | One purchased number |
| [04 — Stay Reachable After the Call](./04-stay-reachable-after-the-call/) | ~15-20 min | An Anthropic API key |
| [05 — Going Further](./05-going-further/) | reference, not timed | — |

Start at chapter 00 and work through in order — each one builds on the
last, and chapter 04 ends with your own phone ringing because of code you
wrote. Go grab it.

## Built with Twilio's own Skills

This curriculum, and the app it teaches you to build, were built using
[Twilio's own Skills](https://github.com/twilio/ai) — the SKILL.md content
behind their `twilio-developer-kit` plugin
([docs](https://www.twilio.com/docs/ai/skills)), launched May 2026 alongside
the [Twilio MCP server](https://www.twilio.com/docs/ai/mcp)
([source](https://github.com/twilio-labs/mcp)). Concretely, here's what
that bought:

- **The auth pattern was checked against `twilio-security-api-auth`**,
  which states plainly that Auth Tokens in production code are "the most
  common credential leak" and API Key + Secret is the production standard.
  Our code already did this — confirmed, not guessed.
- **The outbound call pattern was checked against
  `twilio-voice-outbound-calls`**, and matched their own documented example
  almost line for line. It also caught two things we'd have shipped
  without noticing: outbound calls should respect recipient quiet hours
  (8am-9pm local) and need real consent/TCPA handling. Neither was in our
  code before this check — now it's a documented weak point instead of a
  silent gap. See chapter 03.
- **The WhatsApp send pattern was checked against
  `twilio-whatsapp-send-message`**, which is where the Sandbox's real
  throughput limits (1 message/second, 50/day on trial accounts, a 72-hour
  join expiry) came from — now documented instead of discovered the hard
  way mid-demo.
- **A genuinely fun surprise**: getting this value didn't require
  installing anything. Twilio publishes the Skills as plain public
  markdown files (`github.com/twilio/ai`), so a coding agent — or a human —
  can pull exactly the skill it needs and read it directly, no plugin
  install, no setup step. The one-click `twilio-developer-kit` plugin is
  still the smoother path if you're working interactively and want the
  live MCP search over Twilio's full API surface (1,800+ operations across
  30+ products) — that part, the actual `twilio__search`/`twilio__retrieve`
  tools, we didn't end up needing for this pass, only the Skills content.
  Both are real, and it's worth knowing which one actually did the work.

See `project/AGENTS.md` for the full validation notes.

## Texting runs over WhatsApp, not SMS

US SMS over a normal phone number requires A2P 10DLC carrier registration,
which currently takes anywhere from minutes to over a week to approve.
That's incompatible with "finish this in one sitting," so chapters 02 and
04 use the Twilio WhatsApp Sandbox instead — real messages, free, working
in minutes. Chapter 05 covers what changes for a production sender.

## The project

Every chapter builds on [`project/`](./project/) — a real Angular +
Node/Express app, not a toy. By the end of chapter 04 it's the same code
behind the live "Nobody's Watching the Agent" demo. Read `project/AGENTS.md`
before making structural changes to it.

## License

MIT. Build something with it, break something with it, fork it and make it
weirder — that's the whole point.
