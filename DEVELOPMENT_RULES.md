# CyberFishing development rules

Use OOP/SOLID pragmatically. Each class/module must have one clear responsibility. Prefer composition, constructor injection and small contracts. Avoid god objects, catch-all managers/services, unnecessary inheritance and abstractions.

Target architecture:
ENTRYPOINT → BOOTSTRAP/COMPOSITION → ENGINE / GAME / PLATFORM
DEV may depend on production layers; production must not depend on DEV.

Boundaries:
- engine: reusable mechanisms only; must not know CyberFishing domain.
- game/domain: gameplay rules/state; may depend only on domain + engine.
- game/application: orchestration/use cases; depends on domain, engine and application ports.
- platform: browser implementations such as DOM, Canvas, localStorage, audio, input, scheduling.
- presentation: rendering/UI/HUD/screens.
- dev: overlay, GodMode, diagnostics and balance tools.
- bootstrap: the only place that composes concrete implementations.

Domain/Application must not directly depend on DOM, Canvas, localStorage, Audio API, browser globals or DEV. Runtime config must be injected through constructors/factories/composition; Domain must not directly import raw config globals.

Single Source of Truth does NOT mean one giant GameState. Each mutable fact must have one authoritative owner. Do not duplicate writable state or let UI/debug/render become gameplay state owners.

Architecture migration must not be mixed with gameplay refactoring. During legacy → ESM migration preserve behavior, formulas, APIs, state semantics, save format, timing and performance. Do not opportunistically rebalance, rename APIs or redesign state unless explicitly requested.

Compatibility bridges are temporary only. They may expose existing ESM exports to legacy consumers, but must not own business logic, state, config or new permanent APIs. New code must not depend on the compatibility transport or new globals.

Modules:
- one logical responsibility per file;
- named exports preferred;
- explicit `.js` imports;
- avoid cyclic imports and mass barrel files;
- do not mix gameplay, Canvas, DOM, storage, audio and debug logic in one module.

Performance:
- no unnecessary allocations in hot loops;
- no repeated DOM queries per frame;
- preload assets;
- use deltaTime;
- keep update separate from render;
- cache/reuse data where justified;
- use pooling only for proven high-frequency allocation problems;
- avoid transport/global lookups in hot paths.

For large structural changes: first inspect actual dependencies/consumers, define target boundary and folder structure, then implement. For small changes, do not redesign unrelated architecture.

Do not weaken architecture guards, baselines or whitelists just to make tests green. Validate relevant changes with focused tests + Architecture + Quick + Full + browser smoke when required.

Avoid overengineering. Every abstraction must solve a real problem in ownership, dependency direction, substitution, platform isolation, lifecycle, state isolation, testability or extension.

If information is missing, state safe engineering assumptions and continue. Never invent architecture-critical facts that should be verified from the code.

For reviews, check: behavior, dependency direction, state ownership, SOLID/SRP, runtime identity, compatibility safety, performance, tests and migration removability. Use P0/P1/P2/P3 only when useful.

Priority:
correct behavior → clear ownership → valid dependency direction → maintainability → testability → performance → extensibility → minimal necessary complexity.
