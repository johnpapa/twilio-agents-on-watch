# 05 — Going Further

### ➕ Bonus round

**This level is a map, not a tutorial.** Everything before this point
runs on free, fast, prototyping-grade Twilio tools by design, so you could
finish the whole campaign in one sitting. A real product needs a few
things this campaign deliberately skipped. Here's what changes, briefly —
each of these is a real lesson on its own, not a few paragraphs.

## Text messaging: a registered sender

The WhatsApp Sandbox and this campaign's default setup are for exactly
what they were used for here — fast, free, real. A production deployment
needs a real registered sender instead:

- **A verified WhatsApp Business sender**, if you're staying on WhatsApp —
  your own number, your own brand, no shared sandbox, no 72-hour rejoin.
- **Or SMS over a real 10-digit number**, which brings back **A2P 10DLC**:
  US carriers require brand + campaign registration before they'll deliver
  application-to-person traffic, and unregistered messages are filtered
  *silently* — the API still reports success, the message just never
  arrives. Registration can take from minutes to over a week.

Either path is a real setup project, not a config flag.

## Receiving messages at scale

`listInboundSince()` in this project polls Twilio's message list. That's
the right call for one human and a five-minute window — it's the wrong call
for real traffic. A production version almost certainly moves to a webhook
(a public URL Twilio calls the instant a message arrives) once there's a
stable place to host one, and needs a real datastore instead of the
in-memory `handledSids` set this project uses to avoid double-replying.

## Everything else this campaign's README already told you to fix

If you did the stretch goal in level 04, you've already started on this.
The rest of the repo root README's "known weak points" section is the
honest list: no audit trail, no timeout/backoff policy, no rate limiting or
spend cap on the public number, no real TCPA consent tracking for calls.
None of these are hard, all of them are real, and a production system needs
an actual answer to each one, not a demo-grade shrug.

## Where to actually learn the production setup

That's intentionally out of scope for this repo. If there's enough
interest, it's a natural follow-up campaign — same format, same
one-sitting philosophy, just aimed at "take this from Sandbox to shipped."
