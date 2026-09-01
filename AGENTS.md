# For agents working on this repo

This is a beginner curriculum, structured to be followed by a human typing
commands, or handed chapter-by-chapter to a coding agent as a scoped task.
If you're an AI agent picking this up — either maintaining the curriculum,
or working through it on someone's behalf — here's what to know.

## Structure

- `00-run-the-demo/` through `05-going-further/` — one folder per chapter,
  each with a `README.md`. Chapters build on each other in order.
- `01-build-the-escalation-ladder/` additionally has `starter/` (a TODO'd
  skeleton) and `solution/` (a working reference) — everything else is
  hands-on against the real app in `project/`.
- `project/` — the actual running app every later chapter builds on. It
  converges with, and should stay in sync with, the standalone
  "Nobody's Watching the Agent" live demo. See `project/AGENTS.md` for its
  own conventions before changing it.

## If you're completing a chapter on someone's behalf

Each chapter's README ends with an "If you handed this chapter to an agent
instead" section naming exactly what's agent-shaped and what isn't (account
setup and anything requiring a physical phone always needs the human).
Follow the chapter's stated verification steps exactly — each one names a
command and the output it expects. Don't skip ahead; later chapters assume
earlier ones' code exists.

## If you're editing the curriculum itself

- **Every chapter title needs a verb**, and every chapter needs to earn its
  spot — this curriculum deliberately isn't padded to hit a round number of
  chapters. Cut before you add.
- **No chapter should run over ~20 minutes of active work.** If a chapter's
  growing past that, it's a sign to split it or cut scope, not to write a
  longer README.
- **Keep `project/` and the chapters honest with each other.** If you
  change how `project/` works, update whichever chapter teaches that piece,
  and vice versa — a chapter that no longer matches the code it's teaching
  is worse than no chapter.
- **This curriculum and the live demo should keep converging, not
  diverging.** They share `project/` on purpose.

## Style

Comments and prose here explain *why*, not *what*. Plain, direct language —
this is written to actually be read by someone new to all of this, not
skimmed.
