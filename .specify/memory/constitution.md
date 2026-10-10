<!--
Sync Impact Report (remove before committing this constitution)
Version change: 1.0.0 -> 1.1.0 (owner-selected backend stack and boundary validation)
Modified principles: Development and Backend Boundaries now records Node.js, npm, and TypeScript.
Added sections: none.
Removed sections: none.
Follow-up TODOs: none. Authentication and progress ownership belong to the backend specification.
Dependent templates and skills: unchanged; they read this constitution at runtime.
Sources: owner's current instructions; DEVELOPMENT_RULES.md; docs/architecture.md.
-->

# CyberFishing Constitution

## Core Principles

### I. Clear Responsibilities and Necessary Complexity

Each class and module MUST have one clear responsibility. Use OOP/SOLID pragmatically,
composition, constructor injection, and small contracts. Avoid god objects, catch-all services,
unnecessary inheritance, and speculative abstractions. Every abstraction MUST solve an actual
ownership, dependency, substitution, lifecycle, isolation, testability, or extension problem.

### II. Dependency Direction and Explicit Composition

The client follows ENTRYPOINT -> BOOTSTRAP/COMPOSITION -> ENGINE / GAME / PLATFORM.
Only bootstrap composes concrete configurable, stateful, shared, or host-dependent collaborators.
An owner may construct its own stateless, configuration-free domain or engine calculators.

Engine MUST contain reusable mechanisms without CyberFishing domain knowledge. Game domain
depends only on domain and engine. New application designs use domain, engine, and application
ports. Browser implementations belong in platform; rendering and UI belong in presentation.
DEV may depend on production layers; production MUST NOT depend on DEV.

Domain and application MUST NOT directly access DOM, Canvas, localStorage, audio, browser globals,
or DEV. Runtime configuration MUST be injected; domain MUST NOT import raw configuration globals.
Client modules use named exports, explicit .js imports, and no cyclic imports or mass barrels.
Existing architecture guards remain authoritative checks and MUST NOT be weakened for convenience.

### III. One Authoritative Owner per Mutable Fact

Each mutable fact MUST have one authoritative owner. Do not create one giant GameState merely
to claim a single source of truth. UI, renderers, diagnostics, and persistence adapters MUST NOT
become independent owners of gameplay state. Read models MUST derive from their authoritative
owner. A future client/server split MUST explicitly define ownership and synchronization before
introducing another writable representation of the same fact.

### IV. Behavior Preservation and Measured Performance

Structural migration or refactoring MUST NOT be mixed with gameplay redesign. Preserve behavior,
formulas, APIs, state semantics, save format, timing, runtime identity, and performance unless the
owner explicitly requests the corresponding change. Temporary compatibility bridges MUST NOT
own business logic, state, configuration, or new permanent APIs.

Keep update separate from render, use deltaTime, preload assets, and avoid repeated DOM queries
or unnecessary hot-loop allocations. Cache and reuse data where justified; introduce pooling only
for demonstrated high-frequency allocation problems. Optimization requires behavioral evidence.

### V. Evidence Before Structural Changes

For a large structural change, inspect actual dependencies and consumers, define target boundaries
and folder structure, then implement. Small changes MUST NOT redesign unrelated architecture.
Use focused checks and the Architecture, Quick, and Full suites as relevant to the change.
Perform browser smoke verification when runtime or visible game behavior is affected.
Do not weaken checks, baselines, or whitelists to obtain a passing result.

Reviews MUST examine behavior, dependency direction, ownership, SRP/SOLID, runtime identity,
compatibility safety, performance, tests, and migration removability. State safe assumptions when
information is missing; verify architecture-critical facts against the code rather than inventing them.

## Development and Backend Boundaries

CyberFishing is currently in development. The existing client uses native ESM and Canvas;
this adoption does not add a client build step or change its runtime.

Backend work belongs in the separate backend/ directory and MUST support deployment on a
separate server. Server implementation MUST NOT depend on browser, presentation, or DEV modules.
The owner has selected Node.js, npm packages, and TypeScript for the backend. Server code MUST
pass strict TypeScript checking. External data MUST be validated at runtime before use; static
types do not establish the validity or authority of network input or persisted data.
Client/server contracts, supported runtime versions, framework, database, authentication, and
authoritative gameplay responsibilities MUST be defined in the backend specification and plan.
Do not infer these choices from Spec Kit's sample templates or add infrastructure without a use case.

Local saves and live migration support remain in place while backend architecture is prepared.
Save transfer, schema evolution, synchronization, and retirement of old formats require explicit
requirements for that work; installing tooling MUST NOT silently reset or redesign saved progress.

## Development Workflow

Use Spec Kit for the next bounded change, not to retrospectively recreate the whole game.
Inspect the current repository and preserve unrelated user edits. Existing specs/ records remain
historical evidence; new specifications MUST NOT overwrite them.

Describe outcomes and compatibility constraints in the specification. Resolve architecture-critical
unknowns before implementation. The plan MUST justify boundaries and dependencies using the real
codebase; tasks MUST include the relevant validation. Templates are scaffolding, not instructions
to introduce sample frameworks, services, or features.

For behavior-preserving client changes, the game-cycle output MUST remain identical. Record what
was actually verified. Do not claim browser checks or successful persistence without evidence.
Changes to public APIs, save compatibility, or gameplay need an explicit corresponding scope.

## Governance

This constitution records the owner's existing development rules for Spec Kit. Explicit current
owner instructions take precedence; DEVELOPMENT_RULES.md and docs/architecture.md provide repository
context. When those sources differ, surface the difference and follow the owner's current direction.
Do not use this document to override session authorization or silently introduce new policy.

Amendments MUST document the affected principles, rationale, and compatibility consequences.
Version changes follow semantic versioning: major for incompatible principle changes, minor for
new or materially expanded guidance, and patch for clarifications. Plans and reviews MUST check
the applicable principles; exceptions require a concrete justification consistent with owner scope.

Decision priority is correct behavior -> clear ownership -> valid dependency direction ->
maintainability -> testability -> performance -> extensibility -> minimal necessary complexity.

**Version**: 1.1.0 | **Ratified**: 2026-10-09 | **Last Amended**: 2026-10-09
