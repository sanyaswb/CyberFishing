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

Single Source of Truth does NOT mean one giant GameState. Each mutable fact must have one authoritative owner. Do not duplicate writable state or let UI/debug/render become gameplay state owners.

Structural refactoring must not be mixed with gameplay changes. Preserve behavior, formulas, APIs, state semantics, save format, timing and performance (the game-cycle output must stay identical). Do not opportunistically rebalance, rename APIs or redesign state unless explicitly requested.

Gameplay changes (bug fixes, mechanics, balance) are tracked in `docs/gameplay_backlog.md`, one entry per problem, each with a reproduction, expected and actual behavior, and a priority. One entry is one change:
- reproduce first: a focused check or a deterministic scenario (fixed seed/clock) fails before the fix and passes after it;
- if the fix needs a structural change, commit that first on its own with an unchanged game-cycle baseline, then the gameplay commit;
- when the game-cycle report changes, re-baseline (`npm run baseline:game-cycle`) in the same commit; the commit message says which behavior changed and why;
- balance values live in configuration, not in formulas; a save format change needs an explicit migration decision;
- evidence: focused check, Architecture + Quick + Full, index/dev browser smoke of the changed flow, and the owner's play check for anything that changes feel;
- a bug fix is a backlog entry plus the commit; a new or changed mechanic also gets a spec; releases bump the patch version for fixes and the minor version for mechanics, with a short CHANGELOG line.

The runtime is native ESM: every page loads one module entry. Do not add globals, compatibility bridges or classic scripts.

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
- preload assets;
- optimize every new or replaced raster illustration before integration: always use `utils/convert-images.js` to generate WebP (Middle / quality 80 by default), and reference the optimized file in runtime/catalog data; keep alpha, size runtime art for its use (see "Rendering resolution and image quality"), and retain source masters outside runtime references. Keep SVG artwork as vectors and preserve pixel-exact data maps when selecting compression;
- use deltaTime;
- keep update separate from render;
- cache/reuse data where justified;
- use pooling only for proven high-frequency allocation problems;
- avoid transport/global lookups in hot paths.
- hot-loop read models (for example the fight frame) are reused objects written in place; diagnostics snapshots are built only when DEV composes them;
- normalized configuration is computed once per runtime config revision, not per frame.

Rendering resolution and image quality ([spec 100](specs/100-render-resolution-and-image-quality/spec.md); problem: on phones the
whole canvas was drawn at one pixel per CSS pixel and stretched 2.6–3×, and 2752 px fish art and a 2735 px rod texture
were shrunk 10–14× in one bilinear step):
- gameplay, input, layout, projection and render models use logical (CSS) pixels. Only `CanvasMetricsProvider` (the
  game canvas) and `SpineGlSurface` (GL) touch backing pixels; never read `canvas.width` / `canvas.height` for layout,
  input or game sizes (they are device pixels);
- every on-screen canvas, 2D or WebGL, has a backing store of logical size × pixel ratio (`CONFIG.canvas.maxPixelRatio`
  caps it), its CSS size set explicitly, and draws through a base transform applied at frame start
  (`Canvas2DSurface.beginFrame`, called by the render coordinator). Do not put the transform into a pass that may be
  skipped. Data canvases (depth maps, debug maps) keep their data's pixel size;
- runtime art is sized for its largest on-screen use × the pixel-ratio cap; never draw a master into a small box. Fish
  art has one variant table (`src/game/presentation/fish/fish_art_variants.js`) and the `render-resolution` check
  requires a tracked variant for every master;
- large downscales are filtered: mipmaps for GL textures (`SpineScene` switches pages to trilinear where the GPU can),
  `imageSmoothingQuality = "high"` for 2D. Never rely on a single bilinear step for more than about 2× minification;
- one source per derived asset path: when two modules need "the image for X" (draw and preload), compose one function in
  bootstrap and inject it into both. No module keeps its own default path;
- draw order follows depth: nearer objects are drawn later. When a component gains a new picture (the rod over the
  line's start), review its order instead of inheriting it;
- configuration shares are named and documented as shares of the screen (`ui.rod.spine.heightRatio`), never as image
  scales.

Before creating or changing any design/UI element, read and follow [DESIGN_RULES.md](DESIGN_RULES.md) and [docs/styles.md](docs/styles.md). DESIGN_RULES is the current source for component/style reuse, BEM, tokens, Grid/Flex responsibilities, the 320px logical layout with proportional scaling below it, inventory's four mobile columns, keepnet's two mobile columns and shared parameter-meter semantics. Completed design specs remain historical records.

For large structural changes: first inspect actual dependencies/consumers, define target boundary and folder structure, then implement. For small changes, do not redesign unrelated architecture.

Layer rules are enforced by `utils/architecture-check.js` (see `docs/architecture.md`). Do not weaken it just to make tests green. Validate relevant changes with focused checks + `npm run check` + browser smoke of `index.html` and `dev.html` when the change is visible in the game.

Avoid overengineering. Every abstraction must solve a real problem in ownership, dependency direction, substitution, platform isolation, lifecycle, state isolation, testability or extension.

If information is missing, state safe engineering assumptions and continue. Never invent architecture-critical facts that should be verified from the code.

Remove code and files that are no longer needed (prove unreachability and review every consumer), and optimize only with evidence (unchanged game-cycle output and save bytes). Removing a live check or renaming a public API is an explicit owner decision.

For reviews, check: behavior, dependency direction, state ownership, SOLID/SRP, runtime identity, performance and tests. Use P0/P1/P2/P3 only when useful.

Priority:
correct behavior → clear ownership → valid dependency direction → maintainability → testability → performance → extensibility → minimal necessary complexity.
