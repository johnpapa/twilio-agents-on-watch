# 03 — Place a Real Call

### 👑 Boss level

**~15-20 minutes. The same Twilio account, your trial's free number.**

## The idea

![The text goes unanswered, so the agent escalates to a phone call](../images/03-calling.png)

*The best fifteen seconds in the whole campaign: the text gets no reply, and your pocket starts buzzing. A voice you didn't record reads out a question your code wrote.*

A text that gets no reply tells you almost nothing — the agent can't tell
"still thinking" apart from "never saw it." So it tries a different channel.
Not a louder one; a different one, on a different network, that says the
problem out loud instead of waiting to be read.

This is the best level: your phone actually rings, and a genuinely
good-sounding voice actually speaks the question. Code you wrote made your
pocket buzz. Small thrill, every time.

## Setup

1. **Claim your free number.** Every new Twilio trial account comes with
   one phone number at no charge — Console → Phone Numbers → Manage →
   Active Numbers. If nothing's there yet, go to Phone Numbers → Buy a
   Number, make sure **Voice** is checked, and claim one; trial credit
   covers it, nothing to pay. Copy the number (E.164 format,
   `+15551234567`). *(Already on a paid account instead of a trial? A
   voice-capable number runs about $1/month — buy one the same way.)*
2. **Add it to `.env`** as `TWILIO_VOICE_NUMBER`. Nothing else needs to
   change — the WhatsApp Sandbox number from level 02 stays as-is; this is
   a separate number specifically because a Messaging Service or Sandbox
   number can't place calls.

**Why two numbers?** Because these are two different networks. Your texts go
over WhatsApp — that's the internet. This call goes over the phone network,
the same one a call from your mum uses. Twilio *does* offer WhatsApp voice
calling, but it needs a business-verified sender and the recipient's advance
permission, and it can't reach ordinary phone numbers at all. Two channels on
two networks is the whole point of the escalation: if one doesn't reach a
human, the other one might.

## Your task

Create `project/server/src/scripts/hello-call.ts`:

```ts
import 'dotenv/config';
import { placeEscalationCall } from '../twilio/voice.js';
import { PRESENTER_NUMBER } from '../twilio/client.js';

const sid = await placeEscalationCall(
  PRESENTER_NUMBER(),
  'This is a test call from a script you wrote yourself.',
);
console.log(`Call placed, sid=${sid}. Pick up.`);
```

Run it from `project/server`:

```bash
npx tsx src/scripts/hello-call.ts
```

Your phone should ring within a few seconds.

## What to notice

Open `project/server/src/twilio/voice.ts`. The whole call is one API call —
`client.calls.create({ to, from, twiml })` — with the spoken script handed
in directly as inline XML (TwiML), not a URL to a page that generates it.
That's deliberate: nothing to host, nothing that needs a public server just
to say a sentence out loud.

Read the comment above `placeEscalationCall()`. It's not just a note about
character limits — it's there because Twilio's own guidance for outbound
calls is explicit: confirm intent before calling, and respect the
recipient's local time — calls are only permitted between 8am and 9pm where
they are, not where you are. This demo calls one pre-confirmed
number (you), so that's fine here. It would not be fine in anything that
calls people who didn't sign up for it — that's a real product requirement,
not a nice-to-have, and it's worth internalizing now rather than after
you've shipped something that ignores it.

## Verify it

Run all three level-02 and level-03 scripts back to back, plus
`npm run preflight`, and confirm: a text arrives, a call rings and speaks,
and preflight reports PASS. That's the two channels this whole campaign
is about, both real, both working.

## If you handed this level to an agent instead

Same shape as level 02: buying the number needs you, everything after
`.env` is filled in is agent-shaped — *"Create `hello-call.ts` per this
level, run it, and confirm the call sid is returned."* An agent can't
confirm the phone actually rang, though — that part's still on you.

## Next

**[04 — Stay Reachable After the Call](../04-stay-reachable-after-the-call/)**
— the part that makes this feel less like a script and more like something
that's actually listening.
