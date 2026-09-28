# Check pipeline: cache v2, history base and parallel execution

```text
node utils/run-checks.js [--suite NAME | --check ID] [--jobs N] [--no-seal | --reseal] [--report ABS]
node utils/run-checks.js --acceptance --report <absolute-report-path>
```

## Cache policies and seals (schema 2)

Every check executes under a preloaded input tracer (`core/check_input_tracer.js`). It records, in
order, the files a check reads (with the bytes it consumed), directory listings (the root is `.`,
recursive listings cover the whole subtree), recursive copy sources, `stat`/`lstat` results with their
full metadata, existence probes, `access` modes and outcomes, `realpath`/`readlink` results, every
write, and `git` commands with arguments, working directory, exit status and output. Installed
dependencies are recorded file by file (also through the history base's `node_modules` link).
Anything the cache cannot reproduce is recorded as unsupported: unknown `fs` operations, shell
commands (except the reviewed `net use` probe of vite, re-evaluated like git), other programs,
workers, and contents outside the project and the temporary directory. Node child processes always
inherit the tracer.

A check may reuse a PASS only with an explicit, reviewed cache policy
(`suites/check_policies.js`). The default policy is `never`: the check always executes (it does not
mean "run the whole Full"). The `snapshot` policy names `inputPaths` (files or complete trees whose
names and bytes are fingerprinted before and after the execution) and `environmentKeys`. After a
passing execution the runner seals the check (`node_modules/.cache/cyber-check-seals/<id>.json`)
only when:

- the reviewed inputs did not change during the execution and every consumed input still holds;
- nothing unsupported happened, every `git` command succeeded inside the project, and the check
  wrote nothing inside its execution root (read-then-write checks and output producers are not
  cacheable);
- every consumed input (read, listing, copied tree, link) lies inside the reviewed `inputPaths`, the
  code trees `utils`/`node_modules` (fingerprinted file by file) or the check file itself.
  Existence and metadata probes are complete observations of their own wherever they point: build
  tools probe the ancestors of their workspace for configuration files, recorded as
  `external:<absolute path>` and re-evaluated; reading external contents is unsupported.

The seal records the check definition (id, file, args, suites, policies, execution scope), Node,
platform, architecture, `package.json`, the lockfile, the reviewed environment values, the hashes of
the runner, seal, tracer, report and history reconstruction tooling, the input snapshot, every
observation and the git outputs. A later run reuses it (`[cached]`) only while all of them are
unchanged; version 1, corrupt or incomplete seals are misses. A failed execution removes the seal.
Changed stat metadata may cause a conservative re-execution even when the bytes are identical.

- `--no-seal` executes the selected checks without reusing or creating seals.
- `--reseal` executes the selected checks and seals the eligible ones again.
- `--report ABS` writes a development report (outside the project or under `node_modules/.cache/`).

## Acceptance runs

`--acceptance --report ABS` executes the complete catalog (no `--suite`/`--check`), never counts a
cached result and writes the versioned report (`core/check_report.js`): run id, timestamps, command,
source commit and working-tree fingerprint (tracked and untracked files, uncommitted changes
included) before and after, catalog hash, selected checks, environment and tooling identity, and
per check the status, exit code, duration, output digest and cache/isolation notes. Source drift
during the run fails it. The automated-acceptance lifecycle step validates the report against the
current tree and catalog (`AcceptanceReportValidator`) before it records anything: complete catalog,
unique ids, zero cached, zero failed, zero isolation violations, unchanged source and matching
catalog/tooling fingerprints.

One fully executed acceptance run is required at each stable checkpoint. Metadata-only release
steps do not need another one when their exact allowed delta is verified and runtime, dependencies,
check implementations and scenarios are unchanged.

## History base

History-only checks (suites exactly `["history"]`) of batches up to 025 replay a frozen past. They
run in the exact reconstruction of release 0.24.63 (`core/history_base.js`) with the current `utils`
mirrored in, not in the live tree. The reconstruction peels every newer batch through the recorded
before-images of its history chain, so any drift fails the reconstruction itself. It is prepared
before any check runs and mirrored incrementally (unchanged files keep their metadata), so their
seals change only when the tooling or dependencies they load change, not when a new batch lands.

## Parallel execution

`--jobs N` (default 4). Checks with the reviewed `read-only` isolation (`suites/check_policies.js`)
run in parallel with each other; every other check runs alone. The contract is verified from the
trace on every execution: a write or an unfollowable operation in a read-only check is an isolation
violation that fails the run. A cached PASS is revalidated when its check is scheduled. A check that
fails in parallel stays failed; it is re-executed once sequentially only as a labelled diagnostic,
which is reported separately and never seals.

## Recommended use

- While editing: the focused checks of the changed component (`--check ID`).
- A finished sub-step: `npm run check:quick` plus the relevant architecture checks.
- History replays reuse their proven PASS while the reconstructed state, tooling and every
  observed input are unchanged; a shared tooling change re-executes the replays that load it.
- A stable checkpoint or release gate: one `--acceptance --report ABS` run; reports always state the
  executed and cached counts.
