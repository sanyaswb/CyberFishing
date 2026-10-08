# Feature Specification: Retire historical editing notes in production comments

**Branch**: `develop` · **Created**: 2026-10-08 · **Kind**: comments only

## Verified scope
An Acorn comment scan found 118 Cyrillic comments in 18 tracked files in engine, domain, application
and platform (the handoff estimate was 30 files). Translate useful explanations of reuse, units,
perspective, input timing, caching and UI behavior into English; delete edit markers and redundant narration.
Do not change literals, statements, whitespace inside tokens, formulas or save data.

## Acceptance
Before/after Acorn token type and raw token text must match for every changed file. Architecture,
Quick, Full and the handoff game-cycle digest must pass. No new comment scan allowance in the guard.

Implemented: all 18 token streams match; the same scan now finds zero Cyrillic comments in this scope.
Architecture 2/2, Quick 12/12, Full 37/37 and unchanged game-cycle digest. Browser logic tokens unchanged.
