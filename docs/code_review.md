# The critic's code review before a push

Owner, 2026-11-16: «пропиши в документі як ти діяв і як повинна діяти наступна сесія для перевірки будучи таким
критиком, для виявлення багів і деоптимізацій, детальні ревью і cleanup, це треба додати до правил перед пуш», then:
«перед пуш агент питав власника чи потрібно провести перевірку, і порахував скільки приблизно часу і зусиль це займе,
потім вже проводити чи ні, якщо ні ставить позначку в ТК чи spec перевірка не була проведена».

The review is part of every push (AGENTS.md «Pushes and Pages releases»), but the owner decides each time whether it
runs: the agent asks first, with an estimate (section 0). When it runs, the agent reads the changes as a critic: bugs,
conflicts between modules, deoptimisation, duplication (DRY), architecture (layers, OOP, one responsibility) and weak
checks; every finding is fixed as its own task with a check that fails on the old code. The agent does not test the UI:
the owner checks the look.

## 0. Ask the owner first (mandatory)

Before the push steps, the agent asks the owner whether to run the review, and gives an estimate of its time and effort.

1. Measure what the push carries:
   ```bash
   git log --oneline origin/develop..HEAD | wc -l
   git diff --stat origin/develop..HEAD | tail -1
   git diff --name-only origin/develop..HEAD -- src | sed 's#/[^/]*$##' | sort | uniq -c | sort -rn
   ```
2. Estimate (agent's working time, reading modules in full plus fixes; round up):

   | Changed `src` lines (added + removed) | Modules to read | Review alone | With typical fixes |
   | --- | --- | --- | --- |
   | up to ~300 | up to ~8 | 10–20 min | 30–45 min |
   | ~300–1500 | ~8–25 | 30–60 min | 1–2 h |
   | over ~1500, or several areas (scene, inventory, DevTools…) | 25+ | 1–2 h | 2–4 h |

   Add ~20 min for each library contract that has to be checked against `vendor/` (Pixi, Spine) and for a load
   measurement in Node. Say which areas the time goes to and what is skipped in a shorter variant (for example: only
   the modules with state and timers).
3. Ask one question with the choices: full review / short review (named areas) / no review. Wait for the answer.
4. **No review:** before the push, mark every `TK` (or spec stage) the push carries: in `tasks.md` a sub-line
   `- [ ] Огляд перед push не проводився (власник, <дата>, push <коміт>).`; for a spec, the same line in its
   «Реалізація». The mark stays until a later review covers that work (then it is ticked with the review's `TK`).
5. **Short review:** the same mark for the areas left out, naming them.

## 1. Scope

- Everything the push carries: `git log --oneline origin/develop..HEAD`, `git diff --stat origin/develop..HEAD`, grouped
  by area (weather, scene, inventory, DevTools, checks…).
- Read the touched **modules in full**, not only the diff: a bug often sits in old code next to the new one (TK-358.1
  was found that way).
- When the owner asks «go over all of X», the whole area X, not only the recent commits.
- Other sessions may have committed to the same branch (`git log` with authors): their commits are in the review too.

## 2. Read first

- `docs/incidents.md` → «Rules at a glance» (R1…): every rule is a known trap.
- `docs/rendering.md` (scene, HUD, frames), `DEVELOPMENT_RULES.md` (layers, injection, hot loops),
  `docs/architecture.md`, `DESIGN_RULES.md` / `docs/styles.md` (UI).
- For every library whose behaviour the code relies on (Pixi, Spine): its code in `vendor/`, not documentation from
  memory — what the repository actually ships.

## 3. The checklist

### 3.1 Duplication (DRY) and reuse

1. First look for **what already exists**: `src/engine/math/` (`number_normalization.js`: `clampUnit`, `finiteOr`,
   `pairValue`, `pairBetween`…; `rectangle_bounds.js`: `regionsBounds`…), the scene's shared parts
   (`screen_zone_set.js`, `zone_rect_mask.js`, `background_placement.js`, `scene_color.js`), presentation catalogs
   (`STATUS_LABELS`…).
2. Search for copies of private helpers and methods in neighbouring modules:
   ```bash
   grep -rln "const clamp01 =\|const number = (value, fallback)\|const finite =\|const pairAt =" src
   grep -rn "  #prepareZones(\|  #updateMask(\|  #placeView(\|static #color(\|maskRects" src
   grep -rho "  #[a-zA-Z]*(" src/<area> | sort | uniq -c | sort -rn
   ```
   and in general: the same formulas and the same text formatting in several places.
3. Replace a copy with a shared class (one responsibility, constructor injection, no `Manager/Utils/Helper`) or with
   the existing helper. Reuse instead of writing one more version. Keep the behaviour and the order of random numbers;
   if either changes, tell the owner.
4. A duplicated **representation** in the UI (the same state shown in two DevTools / HUD places) is duplication too
   (DESIGN_RULES «Intuitive interaction»): keep one place, remove the port it no longer needs (prove it has no consumer).

### 3.2 State and lifecycle (where most real bugs are)

- **A field that is set but never reset:** manual holds, overrides, «next time» caches, counters. Example:
  `WeatherEventProcess.#smoothSecOverride` outlived the hold (TK-358.1).
- **`dispose()`:** is everything released (timers, subscriptions, textures), does the composition register the object
  with `own()`, and does `dispose` reset **the fields that describe a timer together with the timer** (TK-358:
  `#timerAtMs`).
- **«Done» recorded before checking that it worked:** the call may fail (no description, no data) — then do not remember
  success (TK-358: `RadiationStatusSource`).
- **Event counters and baselines:** the first frame takes a counter as it is (no event); a frame reset must not look
  like a change (the bolide's `bolideSerial`).
- **On / off pairs:** symmetric; switching off in any order leaves no other process's state behind (R22).
- **Time edges:** windows across midnight, the clock jumping forward, a large `dt` after a hidden tab.

### 3.3 Library contracts

- Check every Pixi / Spine use against `vendor/`: masks (one mask, one container; an unassigned mask is drawn again —
  TK-356.1), `ParticleContainer` (one texture for all particles; dynamic properties), sprite bounds caches.
- A library's test double models the same contract (R1); if it does not, extend the double (as `fakePixi` got the mask
  contract) and check that every existing scenario still passes with it.

### 3.4 Performance (deoptimisation)

- Hot loops (per frame): no allocation (`{}`, arrays, closures, `for…of` over a Map every frame), reused records, work
  only on change, a scene frame only when something moves.
- Nothing is computed for what is not visible: particles start only in the visible part, density is the visible share
  of the whole location (TK-355), filters and masks are clipped to the screen.
- Count full-screen layers, stencil masks, draw calls and new textures; record new ones in `rendering.md` and ask the
  owner for a phone measurement with «ПРОДУКТИВНІСТЬ».
- Measuring load without the UI: a Node script in `utils/tmp/<name>/`, the real renderers on the Pixi double from
  `scene-layer-check.js` (extract `fakePixi` / `fakeDom` into a temporary module), the worst-case settings,
  `performance.now()` per frame, mean and p95 after a warm-up; the result goes into the task, the temporary files are
  removed.

### 3.5 Checks

- Every check of new code **fails on the old code**: put the old file back, run the check, restore byte for byte
  (`cmp`). If it fails structurally (a TypeError) rather than on the assertion about the behaviour, say so.
- Look for checks that pass by luck: a filtered list compared with its source by position (R25), dependence on where a
  random particle appears, «exactly one frame» bounds.
- Doubles keep their contracts (R1, R24); checks never write project sources.

### 3.6 Architecture

- Layers: engine ← game (domain, application) ← platform / presentation ← bootstrap; production never depends on DEV.
  `npm run check` includes `architecture`, but also read whether new logic sits in the right layer (rules in domain,
  state in application, drawing in platform / presentation).
- One module, one responsibility; player-facing text in presentation catalogs; game values in config with DevTools
  labels and a schema check.
- Dead code after a change (methods, ports, config without a reader): remove it after proving it has no consumer.

### 3.7 Documents

- `rendering.md`, `incidents.md` (a significant defect gets an entry and a rule), `architecture.md`, the spec
  («Реалізація»), `tasks.md`, the gameplay backlog: true to the code after the change.

## 4. Fixing what was found

1. Write the finding into `tasks.md`: a new `TK-NNN`, or a sub-item `TK-NNN.N` when it fixes an existing task (what was
   found with `file:line`, the cause, what changes, the check).
2. A check that fails on the old code; the fix; focused checks; one Full (`npm run check`, the game-cycle report
   unchanged or an approved re-baseline).
3. A refactor that keeps the behaviour goes into its own commit, apart from the fixes where they can be split; the
   proof that nothing changed is the existing checks passing without changed expectations.
4. Patch version, CHANGELOG, a local commit with a factual message (what was found, the cause, how it was checked).
5. The report to the owner: the findings by severity, what was fixed, what was not and why, what to look at.

## 5. Example: the weather review of 2026-11-16 (TK-358, TK-358.1)

What the agent did:
1. Read in full the rain, water, ash, starfall and hiss renderers, the weather, emission, wind and starfall-night
   models, the player's statuses and DevTools «ПОГОДА».
2. `grep` for helper definitions and private method names showed copies: screen zones (3), the zone mask (3), the water
   zones' bounding box (2), the background placement (2), colour (3), `clamp01` / `number` / `finite` / `pairAt` in 17
   modules — while `clampUnit` / `finiteOr` already existed in `engine/math`.
3. Moved the shared parts into `ScreenZoneSet`, `ZoneRectMask`, `BackgroundPlacement`, `SceneColor`, `regionsBounds`,
   `pairValue`, `pairBetween`; moved the modules onto them; the existing checks passed unchanged — the behaviour stayed.
4. During the move the ash check failed: it turned out to compare the wrong embers (I-25, R25) — the check was fixed.
5. Went through state and lifecycle: the statuses' `dispose` did not reset the timer's time, the statuses were not
   released with the game, the radiation source remembered success without checking it, the DevTools fade outlived
   its hold — each with a check that fails on the old code.
6. Removed the duplicated status display in «ПОГОДА» and the copy of the countdown format.
7. Two commits: the refactor with the review's fixes, and the fade fix on its own.
