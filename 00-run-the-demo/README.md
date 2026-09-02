# 00 — Run the Demo

**~15 minutes. No Twilio account, no model key.**

## The idea

Before you build any of this, see where you're headed — instant gratification
before the actual work starts. This level is entirely: clone it, run one
command, watch it happen.

## What you're about to see

![The agent finds real data and stops to ask a human](../images/hero-escalation.png)

*Left: the conversation with a human. Right: the agent's live reasoning. The red row is the moment it decides this one isn't its call to make — and by level 04 that text lands on your actual phone.*

An AI agent gets asked to clean up an old database table. It finds a column
that still has 12,400 real rows of live data in it — dropping it would be a
real, irreversible mistake — so it stops and asks a human instead of
guessing. It texts. The human (a scripted stand-in, in this level) ignores
it. It escalates to a phone call. It gets an answer, adapts, finishes the
job, and stays reachable afterward for follow-up questions.

That's the whole campaign, end to end, before you've written a line of
code. Fun part: by level 04, that's not a scripted stand-in anymore —
that's your own phone.

## Your task

```bash
cd project
npm install
npm run practice
```

![The app on first load, waiting for a prompt](../images/00-idle.png)

*This is the screen you'll get. The prompt is pre-filled; you just hit Run.*

Open `http://localhost:4200`. Type the prompt that's already filled in (or
write your own — "clean up the unused columns in the users table and open a
PR" is the one this was built around), hit **Run**, and watch both panes:
the phone-style transcript on the left, the agent's live step-by-step
reasoning on the right.

## What to notice

![A finished run: archived, dropped, and still answering questions](../images/00-complete.png)

*A completed run. Note the status badge flipping to **Done**, and the last two
messages — a question asked after the job finished, and a real answer.*

- The right pane shows the agent finding a column with real data in it and
  explicitly deciding it's not its call to make.
- The left pane's "waiting for reply" counter is real time passing, not a
  progress bar — that's deliberate. Nobody's actually watching the agent.
- Everything here runs against a real SQLite database with real row counts.
  The only things faked in practice mode are the model call and the Twilio
  calls — the schema work is real every time.

## Next

**[01 — Build the Escalation Ladder](../01-build-the-escalation-ladder/)** —
the pattern behind that "text, wait, call" sequence you just watched,
built from scratch.
