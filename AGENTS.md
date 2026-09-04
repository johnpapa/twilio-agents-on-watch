# For agents working on this repo

This is a beginner course, structured to be followed by a human typing
commands, or handed lesson-by-lesson to a coding agent as a scoped task.
If you're an AI agent picking this up — either maintaining the course,
or working through it on someone's behalf — here's what to know.

## Structure

- `00-run-the-demo/` through `04-stay-reachable-after-the-call/` — one folder per lesson,
  each with a `README.md`. Lessons build on each other in order.
- `01-build-the-escalation-ladder/` additionally has `starter/` (a TODO'd
  skeleton) and `solution/` (a working reference) — everything else is
  hands-on against the real app in `project/`.
- `project/` — the actual running app every later lesson builds on. It
  converges with, and should stay in sync with, the standalone
  "Nobody's Watching the Agent" live demo. See `project/AGENTS.md` for its
  own conventions before changing it.

## If you're completing a lesson on someone's behalf

Each lesson's README ends with an "If you handed this lesson to an agent
instead" section naming exactly what's agent-shaped and what isn't (account
setup and anything requiring a physical phone always needs the human).
Follow the lesson's stated verification steps exactly — each one names a
command and the output it expects. Don't skip ahead; later lessons assume
earlier ones' code exists.

## If you're editing the course itself

- **Every lesson title needs a verb**, and every lesson needs to earn its
  spot — this course deliberately isn't padded to hit a round number of
  lessons. Cut before you add.
- **No lesson should run over ~20 minutes of active work.** If a lesson's
  growing past that, it's a sign to split it or cut scope, not to write a
  longer README.
- **Keep `project/` and the lessons honest with each other.** If you
  change how `project/` works, update whichever lesson teaches that piece,
  and vice versa — a lesson that no longer matches the code it's teaching
  is worse than no lesson.
- **This course and the live demo should keep converging, not
  diverging.** They share `project/` on purpose. See `project/AGENTS.md`'s
  "Keeping things in sync" checklist before touching UI or server code —
  it names exactly what has to be checked in both `project/` and the
  standalone `Twilio-demo` repo.

## Git workflow

- **Never commit directly to `main`.** Create a feature branch, push it,
  and open a pull request instead — every change, even a small fix.
- **Once a PR is open and CI passes, don't leave it sitting.** Merge it
  yourself if it's low-risk and well-tested, or ask if you're unsure —
  either way, report the outcome. Don't go quiet after opening a PR.
- **If CI is red or still pending, don't merge.** Fix it, wait, or report
  the blocker instead.
- **Whenever you merge, use squash**, then **delete the branch** —
  local and remote. Don't leave merged branches around.

## Style

Comments and prose here explain *why*, not *what*. Plain, direct language —
this is written to actually be read by someone new to all of this, not
skimmed.
