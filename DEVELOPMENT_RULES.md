# CyberFishing development rules

Use OOP/SOLID pragmatically. Each class/module must have one clear responsibility. Prefer composition, constructor injection and small contracts. Avoid god objects, catch-all managers/services, unnecessary inheritance and abstractions.

Target architecture:
ENTRYPOINT → BOOTSTRAP/COMPOSITION → ENGINE / GAME / PLATFORM
DEV may depend on production layers; production must not depend on DEV.

Boundaries:
- engine: reusable mechanisms only; must not know CyberFishing domain.
- game/domain: gameplay rules/state; may depend only on domain + engine.
- game/application: orchestration/use cases; depends on domain, engine and game config.
- platform: browser implementations such as DOM, Canvas, localStorage, audio, input, scheduling.
- presentation: rendering/UI/HUD/screens.
- dev: overlay, GodMode, diagnostics and balance tools.
- bootstrap: the only place that composes concrete implementations.

Domain/Application must not directly depend on DOM, Canvas, localStorage, Audio API, browser globals or DEV. Runtime config must be injected through constructors/factories/composition; Domain must not directly import raw config globals.

Client-server architecture and backend boundaries:
```text
CLIENT (Browser) ↔ [WebSocket / REST] ↔ BACKEND (Node.js / TypeScript)
```
- Authoritative backend (Node.js & TypeScript): the backend is implemented in TypeScript on Node.js (Fastify for REST/HTTP, ws/uWebSockets for real-time game traffic). Critical gameplay math, RNG seed handling, fish generation, bite chances, loot tables, catch weight/size, fight outcome validation, shop purchases, and inventory persistence live exclusively on the backend. The client never dictates catch results or currency grants.
- Shared domain: pure Domain and Engine logic (`src/game/domain/`, `src/engine/`) remains platform-agnostic (zero DOM/Canvas dependencies) so calculation models, physics formulas, tackle stress budgets, and rules can be evaluated identically on the Node.js backend.
- Client-server separation and framework policy: the client is strictly a rendering (Canvas 2D / WebGL PixiJS, Spine), animation, HUD, audio, and input layer running a 60 FPS game loop. Heavy enterprise frameworks (such as Angular) and reactive Virtual DOM frameworks (such as Vue) are prohibited on the client: they introduce change-detection/Zone.js game-loop conflicts, GC pause stuttering, and unnecessary overhead in real-time 60 FPS rendering. Real-time gameplay synchronization uses WebSockets; account, persistence, and transactional inventory actions use REST/RPC (Fastify).
- TypeScript roadmap: the backend is written 100% in TypeScript from day one. The client codebase remains on zero-build native ESM in Vanilla JavaScript prior to version 1.0.0 for maximum iteration speed, instant browser refresh, and transparent debugging: the repository and local development (`npm run dev`) run the source modules with no build step; only a release is built (`npm run build:release`, spec 157 R13: esbuild bundles from a commit, the same release folder for GitHub Pages and the game server, the source modules kept for the `?esm=1` fallback; server requirements in [docs/deployment.md](docs/deployment.md)); after version 1.0.0, the entire client codebase will undergo a planned migration to TypeScript.

Single Source of Truth does NOT mean one giant GameState. Each mutable fact must have one authoritative owner. Do not duplicate writable state or let UI/debug/render become gameplay state owners.

Structural refactoring must not be mixed with gameplay changes. Preserve behavior, formulas, APIs, state semantics, save format, timing and performance (the game-cycle output must stay identical). Do not opportunistically rebalance, rename APIs or redesign state unless explicitly requested.

Gameplay changes (bug fixes, mechanics, balance) are tracked in `docs/gameplay_backlog.md`, one entry per problem, each with a reproduction, expected and actual behavior, and a priority. One entry is one change:
- reproduce first: a focused check or a deterministic scenario (fixed seed/clock) fails before the fix and passes after it;
- if the fix needs a structural change, commit that first on its own with an unchanged game-cycle baseline, then the gameplay commit;
- when the game-cycle report changes, re-baseline (`npm run baseline:game-cycle`) in the same commit; the commit message says which behavior changed and why;
- balance values live in configuration, not in formulas; a save format change needs an explicit migration decision;
- evidence: focused check and one Full run (includes Architecture and Quick), index/dev browser smoke of the changed flow, and the owner's play check for anything that changes feel;
- a bug fix is a backlog entry plus the commit; a new or changed mechanic also gets a spec; delivered changes bump only the patch version with a short CHANGELOG line. The minor (middle) version must stay unchanged until the owner explicitly requests its change, including for new/changed mechanics (owner instruction, 2026-10-20; supersedes automatic minor bumps).

The runtime is native ESM: every page loads one module entry. Do not add globals, compatibility bridges or classic scripts. In a release the entry is the generated boot module (spec 157 R13); source code never depends on being bundled (no bundler-only syntax, no `import.meta` tricks, only literal relative import specifiers).

Modules:
- one logical responsibility per file: at most one exported class, and the file is named after it;
- class names state the responsibility (no `Manager`, `Utils`, `Helper`);
- player-facing text lives in presentation catalogs injected through constructors; diagnostics stay with the logger call, persisted names are Domain save-format constants (the guard rejects any other Cyrillic literal outside presentation, config and DEV);
- named exports preferred;
- explicit `.js` imports;
- avoid cyclic imports and mass barrel files;
- do not mix gameplay, Canvas, DOM, storage, audio and debug logic in one module.
- composition: a class may create its own stateless, configuration-free Domain/engine calculators; everything stateful, configurable, host-dependent, DEV-only, shared or meant to be replaced (strategies such as knowledge policies) is created in bootstrap and injected; a constructor default must never create such a collaborator;
- reuse before copying: shared numeric normalization lives in `engine/math/number_normalization.js`; DEV tools compose production classes instead of copying them;
- DEV-only behavior (GodMode effects, Fixed Catch, fight diagnostics snapshot, overlays) reaches production code only through injected ports whose production implementation is inactive or absent.

Performance:
- UI performance and input states follow [DESIGN_RULES.md](DESIGN_RULES.md), especially sections 10 and 13.
- coalesce viewport/Canvas resize work before the next game update; DOM UI measurements have at most one pending frame, not a continuous extra loop;
- unchanged dimensions/readings must cause zero CSS layout writes, Canvas bitmap resets and subscriber updates;
- size-observer feedback must settle: do not observe content whose size the viewport adapter itself sets; write flow footprints only when changed;
- dispose scheduled frames, observers, media-query listeners and UI subscriptions with their owner; repeated panel openings must not multiply work;
- no unnecessary allocations in hot loops;
- no repeated DOM queries per frame;
- load assets through the asset load plan (see "Loading and startup optimization" below), not through ad hoc preloads;
- optimize every new or replaced raster illustration before integration: always use `utils/convert-images.js` to generate WebP (Middle / quality 80 by default), and reference the optimized file in runtime/catalog data; keep alpha, size runtime art for its use (see "Rendering resolution and image quality"), and retain source masters outside runtime references. Keep SVG artwork as vectors and preserve pixel-exact data maps when selecting compression;
- use deltaTime;
- keep update separate from render;
- cache/reuse data where justified;
- use pooling only for proven high-frequency allocation problems;
- avoid transport/global lookups in hot paths.
- hot-loop read models (for example the fight frame) are reused objects written in place; diagnostics snapshots are built only when DEV composes them;
- normalized configuration is computed once per runtime config revision, not per frame.

Rendering — **mandatory reading before any rendering work**: [docs/rendering.md](docs/rendering.md). That covers
renderers, render passes, the canvas or its size, image assets and their sizes, Spine, the HUD over the canvas and the
frame loop. It holds the incidents (blurred canvas and pixelated art, spec 100; portrait phones at 10–17 FPS from
`imageSmoothingQuality = "high"`, spec 102) and the rules that prevent them:
- three render roles: the WebGL scene through PixiJS (world, Spine, effects), a 2D canvas (HUD text) and DOM
  (windows); Pixi stays a renderer behind our ports (spec 103);
- many image layers and Spine-first animation are paid in draw calls, overdraw and texture memory: atlases, cached
  static layers, trimmed layers, a texture budget;
- logical (CSS) pixels everywhere, backing pixels only in their owners;
- the image filter is chosen per draw by the surface, never `"high"`;
- art sized close to 1:1 with the screen;
- the 16.7 ms frame budget includes the GPU;
- every rendering change is measured on a phone in both orientations with the DevTools overlay "⚡ ПРОДУКТИВНІСТЬ"
  before the commit;
- draw order follows depth.

**Loading and startup optimization — mandatory (owner, 2026-10-31; spec 157).** The game will keep growing, so
optimization is part of every change, never an afterthought:
- **Budgets are a starting point, not a finish line.** The current targets (cold start on 4G: first paint ≤ 1 s, ready
  to play ≤ 3–4 s, ≤ 3 MB compressed before the start) are the floor. "Already within budget" is never a reason to skip
  an optimization or to accept a regression; every change keeps the numbers or improves them, and a budget miss found by
  the measurer is a defect (record it in docs/incidents.md).
- **The main metric is the cold start of a new player** (no cache, phone, mobile network). Caching is a bonus, never the
  fix.
- **Measure before and after.** Every change that can affect loading is measured with `npm run measure:startup`
  (Fast 4G, `--network 3g`, `--cpu 4`) on the built release, and the numbers go into the spec or the commit message;
  phone reports come from the DEV overlay "⏱ ЗАВАНТАЖЕННЯ" («Завантажити JSON»). Bytes are counted compressed.
- **The start loads only what the first frame needs.** Everything else goes to a later layer of the asset load plan
  (layer two: the full game cycle; layer three: content opened later, in the background) or loads on first use. A new
  asset, module or feature never joins the start silently: it needs an explicit place in the plan.
- **Nothing on the start waits for what it does not need.** No `await` on decorative artwork, selectors, previews or
  warm-ups before `ready`; show a stand-in (sprite symbol, classic control, static pose) and replace it later (R11).
- **Assets by stable id, never by path.** Code and configuration reference assets through the asset registry ids;
  `npm run assets:sync` registers new and moved files and its `--check` runs in Full. Raster art is display-sized and
  converted with `utils/convert-images.js`.
- **Progressive images.** Every raster image has a generated low-quality copy: when the player opens content that has
  not loaded, it gets priority 1, the low copy shows first (a loader only if it is late), and the full image replaces it
  instantly once decoded, in the same box (no layout jump).
- **Code:** the repository stays zero-build; a release is bundled (`npm run build:release`) and must run the same on
  GitHub Pages and on the game server. Features not needed for the first frame load with dynamic `import()` through the
  composition, and their chunks are not preloaded by the page.
- **After the network, the CPU.** When transfer is no longer the bottleneck, measure the main-thread work of the start
  (decode, composition, uploads) and move it off the critical path (deferred work, later Web Workers).

Before creating or changing any design/UI element, read and follow [DESIGN_RULES.md](DESIGN_RULES.md) and [docs/styles.md](docs/styles.md). DESIGN_RULES is the current source for component/style reuse, BEM, tokens, Grid/Flex responsibilities, the 320px logical layout with proportional scaling below it, inventory's four mobile columns, keepnet's two mobile columns and shared parameter-meter semantics. Completed design specs remain historical records.

For large structural changes: first inspect actual dependencies/consumers, define target boundary and folder structure, then implement. For small changes, do not redesign unrelated architecture.

Layer rules are enforced by `utils/checks/architecture/architecture-check.js` (see `docs/architecture.md`). Do not weaken it just to make tests green. Validate relevant changes with focused checks + `npm run check` + browser smoke of `index.html` and `dev.html` when the change is visible in the game.

Avoid overengineering. Every abstraction must solve a real problem in ownership, dependency direction, substitution, platform isolation, lifecycle, state isolation, testability or extension.

If information is missing, state safe engineering assumptions and continue. Never invent architecture-critical facts that should be verified from the code.

Remove code and files that are no longer needed (prove unreachability and review every consumer), and optimize only with evidence (unchanged game-cycle output and save bytes). Removing a live check or renaming a public API is an explicit owner decision.

**Utils cleanup step (owner, 2026-10-18): every spec or stage that replaces a tool ends with removing the tools that
are now certainly unused.** Before the commit, list the `utils/` scripts, test helpers, fixtures, vendor files and
`package.json` scripts or devDependencies that the change made obsolete (example: spec 103 stage 0 removed
`utils/vendor-spine.js` once `utils/vendor-libraries.js` wrote the whole manifest). For each one:
- prove it has no consumer: grep the repository, `utils/testing/suites/check_manifest.js`, `package.json` scripts,
  docs and specs that tell people to run it;
- delete it in the same change and update the docs that named it;
- record what was removed in the spec.

Removing a live functional check (an entry in the check manifest) stays an owner decision. The owner's utils audit
request (2026-10-20) explicitly authorizes removing visual and duplicate implementation assertions; preserve useful
behavioral simulations and architecture/safety guards. Tools kept "just in case" are not allowed: history keeps them.

## Tools and test policy

Read [utils/UTILS_RULES.md](utils/UTILS_RULES.md) before changing utils or tests. Automate hard-to-reproduce behavior:
equipment combinations, casting/fishing outcomes, state transitions, persistence, input, async failures and cleanup.
The owner checks pixels, spacing, colors and other appearance. Extend existing deterministic scenarios before adding
a check; avoid tests that merely mirror CSS, markup or implementation spelling. Keep production boundaries and guards.

During iteration run the affected checks. Before delivery run `npm run check` once; it includes the Quick and
Architecture subsets, so separate unchanged reruns are unnecessary. Rerun after meaningful changes or failures.

**Library contracts and their test doubles (incident v0.46.0, TK-024).** A check that replaces a library (PixiJS,
Spine, the Canvas context, the DOM) with a fake proves only that our code calls the fake the way we expect. If the fake
is simpler than the library, the check passes while the real library behaves differently. In v0.46.0 the float sprite
was cropped by changing its texture frame in place; real Pixi recalculates a sprite's bounds only when the texture is
replaced or a `dynamic` texture emits `update`, so the cropped art stretched on every phone, while the fake sprite
(plain fields) passed. Rules:
- Before relying on a library behaviour that involves **caching or invalidation** (cached bounds, textures, layout,
  uploaded buffers, change events, dirty flags), read it in the vendored source (`vendor/…`) and name the exact rule in
  a comment next to the call (e.g. "Pixi 8 sprites follow frame changes only for `dynamic` textures").
- **Prefer replacing over mutating** library objects whose consumers cache derived data; mutate in place only through
  the library's documented update path, and then make that path explicit (`dynamic: true` plus `update()`).
- A fake used by a check reproduces **every part of the library contract the code depends on**, including the
  invalidation rule: what is recalculated, when, and what stays stale. Assert the observable result the library
  would produce (for example the rendered size = cached bounds × scale), not only the values our code assigned.
- When a fake is extended for new code, first make the check fail on the code without the library's update path, then
  fix the code. A fake that cannot fail for the real defect is not a check of that defect.
- Visual results stay the owner's check; a rendering change that mutates library state names this risk in the owner's
  check list (the device and the frame where it would show).

## Development history and changelog retention

Keep active development documents concise and focused on current rules and work. Move superseded chronological history to its archive instead of accumulating long histories in active documents.

- CHANGELOG.md keeps only the latest **10 release entries**, including the current release.
- Whenever adding a release, move every older complete entry to the canonical [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>) specified by the owner. Keep the archive link in CHANGELOG.md.
- Sort both files by numeric version components, newest first; for example, 0.24.100 comes before 0.24.99. Preserve historical four-part version numbers. Merge identical entries by version without duplicates and preserve their complete text. Reconcile differing text for one version without losing information.
- During ordinary work read the recent changelog; consult archived versions only when the task needs that history. The archive retains the full history and is not a disposable generated service artifact.

**Incidents (owner, 2026-10-30).** Significant defects and the rules they taught are kept in
[docs/incidents.md](docs/incidents.md) (rendering ones also in docs/rendering.md). Add the entry with the fix; follow
its rules table (test doubles with the real contract, production-shaped test data, anisotropic ground plane, one source
for asset values, per-time damping, plan-then-steer agents, safe old-code proofs).

For reviews, check: behavior, dependency direction, state ownership, SOLID/SRP, runtime identity, performance and tests. Use P0/P1/P2/P3 only when useful.

Priority:
correct behavior → clear ownership → valid dependency direction → maintainability → testability → performance → extensibility → minimal necessary complexity.
