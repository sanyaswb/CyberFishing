# Feature Specification: Persistent mesh editing and server-validated DEV shortcut

**Created**: 2026-10-23
**Status**: Implemented in v0.47.1; owner visual acceptance pending
**Input**: Opening DevTools from the left edge preserves the active mask; a first cheat opens DevTools in DEV with its definition outside the client.

## User Scenarios & Testing

### User Story 1 — Open the panel without losing paint (P1)
An owner paints a mask then opens the panel from the left edge. The draft, subdivision, selected cells and opacity remain intact, including repeated rebuilds.
Acceptance: replacing a section releases its subscriptions without ending the session draft. Real tool disposal, location/selection/category/editor changes still cancel stale editing.

### User Story 2 — Type a server-owned shortcut (P1)
On the local DEV page the owner types the configured code outside input fields; the server returns an allowed action and the panel opens idempotently.
Acceptance: no literal code, hash, local recognition dictionary or offline fallback is included in the browser modules or Pages release. The local DEV server owns verification. Static gh-pages cannot validate it until a backend is deployed.

## Requirements
- FR-001: Panel rebuilds MUST preserve mask drafts; application disposal MUST release them.
- FR-002: Only DEV composition MUST attach keyboard recognition. Ignore inputs/selects/textareas/contenteditable, modifier shortcuts, repeat/composition; never block ordinary game input.
- FR-003: The browser MUST send a bounded recent alphabetic candidate after an idle debounce, accept only the server's explicit open action, clear on focus loss, and discard stale/failed/late responses.
- FR-004: Validation MUST remain server-side. The local endpoint MUST limit request size, require JSON and same-origin requests, disable caching and never return the code. Server/tool/spec/repository files MUST not be available through static routes.
- FR-005: Opening MUST be idempotent. No key listener, timer or request may survive disposal; production imports no DEV tool.

## Success Criteria
- Reopening/rebuilding the panel preserves the exact draft object/cells and view settings.
- A successful server answer opens once; unrelated text, editable fields, failures and stale answers do not open it.
- The code exists only in server-owned source, excluded from release files; direct HTTP retrieval is refused.

## Assumptions and acceptance
No gameplay backend currently exists; use the existing loopback DEV server, not a new production backend. A cheat opens an already-DEV tool and is not an authentication mechanism. The chosen code is supplied by the owner in chat and defined solely in server source. Keyboard typing is case-insensitive; prior letters may precede it. Owner checks visuals in dev.html, both orientations; agent performs functional checks only.

## Implementation evidence
Panel rebuild disposal preserves the session-owned draft, while final disposal stops it. The injected DEV input owns bounded candidate/timer/request state; only an explicit server action calls idempotent DevTools.open(). Local server static routes exclude server/tool/spec/repository files. Existing mesh/config-runtime scenarios and a new real HTTP/input lifecycle check pass. Full: 68/68 including Architecture/Quick; game-cycle baseline unchanged. No obsolete tools, dependencies or visual checks. Restart npm run dev to load the new endpoint; static Pages has no verifier.
