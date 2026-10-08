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

The runtime is native ESM: every page loads one module entry. Do not add globals, compatibility bridges or classic scripts.

Modules:
- one logical responsibility per file: at most one exported class, and the file is named after it;
- class names state the responsibility (no `Manager`, `Utils`, `Helper`);
- player-facing text lives in presentation catalogs injected through constructors; diagnostics stay with the logger call, persisted names are Domain save-format constants (the guard rejects any other Cyrillic literal outside presentation, config and DEV);
- named exports preferred;
- explicit `.js` imports;
- avoid cyclic imports and mass barrel files;
- do not mix gameplay, Canvas, DOM, storage, audio and debug logic in one module.
- composition: a class may create its own stateless, configuration-free Domain/engine calculators; everything stateful, configurable, host-dependent, DEV-only or shared is created in bootstrap and injected (when production always injects a collaborator, its constructor default is removed and tests compose it);
- reuse before copying: shared numeric normalization lives in `engine/math/number_normalization.js`; DEV tools compose production classes instead of copying them;
- DEV-only behavior (GodMode effects, Fixed Catch, fight diagnostics snapshot, overlays) reaches production code only through injected ports whose production implementation is inactive or absent.

Performance:
- no unnecessary allocations in hot loops;
- no repeated DOM queries per frame;
- preload assets;
- use deltaTime;
- keep update separate from render;
- cache/reuse data where justified;
- use pooling only for proven high-frequency allocation problems;
- avoid transport/global lookups in hot paths.
- hot-loop read models (for example the fight frame) are reused objects written in place; diagnostics snapshots are built only when DEV composes them;
- normalized configuration is computed once per runtime config revision, not per frame.

For large structural changes: first inspect actual dependencies/consumers, define target boundary and folder structure, then implement. For small changes, do not redesign unrelated architecture.

Layer rules are enforced by `utils/architecture-check.js` (see `docs/architecture.md`). Do not weaken it just to make tests green. Validate relevant changes with focused checks + `npm run check` + browser smoke of `index.html` and `dev.html` when the change is visible in the game.

Avoid overengineering. Every abstraction must solve a real problem in ownership, dependency direction, substitution, platform isolation, lifecycle, state isolation, testability or extension.

If information is missing, state safe engineering assumptions and continue. Never invent architecture-critical facts that should be verified from the code.

Remove code and files that are no longer needed (prove unreachability and review every consumer), and optimize only with evidence (unchanged game-cycle output and save bytes). Removing a live check or renaming a public API is an explicit owner decision.

For reviews, check: behavior, dependency direction, state ownership, SOLID/SRP, runtime identity, performance and tests. Use P0/P1/P2/P3 only when useful.

Priority:
correct behavior → clear ownership → valid dependency direction → maintainability → testability → performance → extensibility → minimal necessary complexity.
