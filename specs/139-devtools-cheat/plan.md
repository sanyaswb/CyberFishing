# Plan
Keep ZoneMaskEditor session-owned: section disposal accepts a rebuild mode, while DevTools final disposal still stops it.
Compose a DEV keyboard port in bootstrap with injected event target/scheduler/fetch; server action opens DevTools idempotently.
An isolated CommonJS endpoint under utils/server owns validation; the local static resolver serves only browser entry pages and runtime folders.
Extend existing zone-editor scenarios and add one functional server/input scenario. Verify real HTTP behavior, bounded input, stale replies, production exclusion and cleanup. No deployment or commit requested in this change.
