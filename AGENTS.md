# For agents working on this repo

This is a beginner campaign, structured to be followed by a human typing
commands, or handed level-by-level to a coding agent as a scoped task.
If you're an AI agent picking this up — either maintaining the campaign,
or working through it on someone's behalf — here's what to know.

## Structure

- `00-run-the-demo/` through `05-going-further/` — one folder per level,
  each with a `README.md`. Levels build on each other in order.
- `01-build-the-escalation-ladder/` additionally has `starter/` (a TODO'd
  skeleton) and `solution/` (a working reference) — everything else is
  hands-on against the real app in `project/`.
- `project/` — the actual running app every later level builds on. It
  converges with, and should stay in sync with, the standalone
  "Nobody's Watching the Agent" live demo. See `project/AGENTS.md` for its
  own conventions before changing it.

## If you're completing a level on someone's behalf

Each level's README ends with an "If you handed this level to an agent
instead" section naming exactly what's agent-shaped and what isn't (account
setup and anything requiring a physical phone always needs the human).
Follow the level's stated verification steps exactly — each one names a
command and the output it expects. Don't skip ahead; later levels assume
earlier ones' code exists.

## If you're editing the campaign itself

- **Every level title needs a verb**, and every level needs to earn its
  spot — this campaign deliberately isn't padded to hit a round number of
  levels. Cut before you add.
- **No level should run over ~20 minutes of active work.** If a level's
  growing past that, it's a sign to split it or cut scope, not to write a
  longer README.
- **Keep `project/` and the levels honest with each other.** If you
  change how `project/` works, update whichever level teaches that piece,
  and vice versa — a level that no longer matches the code it's teaching
  is worse than no level.
- **This campaign and the live demo should keep converging, not
  diverging.** They share `project/` on purpose.

## Style

Comments and prose here explain *why*, not *what*. Plain, direct language —
this is written to actually be read by someone new to all of this, not
skimmed.
