# Native production / Stage 6 DEV decision

Date: 2026-10-04. Owner instruction in the current chat; base `bad1cb007c21c5e86dc2e08fa1a2613c89b4d52e`.

Owner decision 2026-10-04: Stage 5 completes native default production through game.entry -> Production Bootstrap -> Engine/Game/Platform. dev.html retains the existing classic/IIFE startup until native dev.entry in Stage 6. No new legacy loader and no native/IIFE combination within one realm. Preserve all enabled Fixed Catch/GodMode gameplay effects through injected production dependencies; diagnostics may be explicitly absent. Save/state/boundary/acceptance requirements are unchanged.

Stage 5 replaces the default page script list with the one production module entry.
The existing DEV document moves intact to dev.html, preserving URLs/order/split slots.
Existing legacy build/VM tools use that retained document as their single current
legacy-order input. Production checks inspect the actual index.html and import closure.
No live guard, evidence, baseline or policy exception is weakened.

Graph v8 preserves completed 001–027/029 membership and evidence, changes the
explicit browser scope for 028, and adds intact Fixed Catch prerequisite 030.
GodMode gets a stateless injected production reader of the sole config owner.
Optional diagnostic factories must be validated when supplied; production creates
no fake overlay/render/watchdog. Keep formulas, saves, source state and live settings.

Stage 6 delivers dev.entry -> Development Bootstrap -> production modules + DEV,
then removes the old DEV transport only after all listed consumers migrate.
The earlier loader proposal and solution review remain historical recommendations;
this owner decision supersedes them. No new loader is authorized or implemented.
