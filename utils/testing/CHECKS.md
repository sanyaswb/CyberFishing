# Check pipeline: seals, history base and parallel execution

`node utils/run-checks.js [--suite NAME | --check ID] [--jobs N] [--no-seal | --reseal]`

## Seals

Every check runs with a preloaded input tracer (`core/check_input_tracer.js`). It records the
project files the check reads, the directories it lists, the paths it probes, the modules it loads,
the project files it writes and the output of `git` commands; node child processes are traced too.
After a passing run the runner stores a seal (`node_modules/.cache/cyber-check-seals/<id>.json`):
the content hash of every input, the git outputs, the written paths and the environment (Node
version, platform, lockfile, tracer and seal logic).

A later run skips a check only while every recorded input is byte-identical (`[sealed]`); any
change, a new file in a listed directory, a changed git output, another environment or a changed
check definition executes it again (`[run] <reason>`). Paths the check itself wrote are outputs and
not inputs. A failing check loses its seal.

- `--no-seal` executes every check without tracing (the classic runner).
- `--reseal` executes every check and records fresh seals (periodic full verification).
- Summaries state how many checks were executed and how many were sealed; acceptance evidence
  records both.

## History base

History-only checks (suites exactly `["history"]`) of batches up to 025 replay a frozen past. They
run in the exact reconstruction of release 0.24.63 (`core/history_base.js`) with the current
`utils` copied in, not in the live tree. The reconstruction peels every newer batch through the
recorded before-images of its history chain, so any drift fails the reconstruction itself. Their
seals therefore change only when the tooling they load changes, not when a new batch lands. The
base is cached per project root and rebuilt whenever the live data or the base itself changed.

## Parallel execution

With seals, unsealed checks run in `--jobs N` processes (default 4; `--jobs 1` keeps the sequential
order and live output). Two checks conflict when one wrote a path the other read or wrote in its
last sealed run within the same scope (live tree or history base); conflicting checks never run at
the same time, and a check without a known footprint runs alone. A check that fails in parallel is
retried once sequentially before it is reported.

## Recommended use

- During development: `npm run check:quick` and `npm run check:architecture` (seconds when little
  changed).
- Acceptance and release: the full catalog with seals; the summary and evidence name the executed
  and sealed checks.
- Periodically (for example at a stage closure) and after changes to the tracer or runner:
  `node utils/run-checks.js --reseal` on a snapshot copy, which executes every check.
