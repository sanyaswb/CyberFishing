# TK-010: repeated picks, cancellation and missing-prerequisite feedback

Owner request and scope correction: 2026-10-20. Implementation: v0.45.29–v0.45.30; owner acceptance and final Full pending.

Scope: TK-010 includes header bait/chum, TK-010-1 (equipment/editor pickers), TK-010-2 (pick cancellation),
and explanatory feedback when consumable prerequisites are missing. These form one whole task in the first
pair alongside TK-009. Only after owner feedback on TK-009 may work start on TK-011/TK-012 and their subpoints.

## Behavior

- First activation opens the existing compatible pick. Another icon changes its target without equipping.
- Repeat the same highlighted icon to equip exactly one first compatible item in the current displayed
  list, respecting its filtering and sorting. An empty list is a no-op; never fall back to repository order.
- Preserve the existing priority of an item already selected manually for replacement confirmation.
- Use the normal atomic attachment/replacement path, returning the old consumable and preserving refill
  settings, save format, section behavior and the existing successful-pick cleanup.
- Empty equipment cells and empty editor sockets use the same repeat contract. Portrait editor targets
  become highlighted while retaining the inline choices; the repeated candidate follows that visible inline
  list, while wide layouts use the ordered main list. Filled-item taps/removal keep their existing semantics.
- On an active highlighted target, a 200ms primary-pointer hold or mouse right-click cancels the pick. Clear
  target/selection/placement highlights while retaining the page/editor. Suppress the following compatibility
  click; movement, pointer cancel, resize, blur, stale DOM and disposal cancel the hold. Existing filled-item
  removal delays are independent. Disable browser context menus across the game, including editable controls.
- Missing header prerequisites remain explainable: pressing the grey icon dispatches the ordinary command,
  shows the existing warning, and reveals the relevant equipment field with the shared two-flash overlay in
  red (rod if absent, otherwise tackle). Reuse feedback revisions and reduced motion; no inventory mutation.

## Ownership

The UI obtains the current canonical view model only on activation. For a highlighted icon it submits an
optional candidateInstanceId from the ordered visible list. This is a user selection intent, not gameplay
authority. InventoryCommandService verifies the active slot/kind/socket, current repository custody, reservation
and target compatibility before executing the existing transaction. It owns pick completion; no UI state copy,
new globals, per-frame query or application dependency on presentation is introduced. InventoryUiState owns
pick cancellation and rejection feedback. The delegated browser cancellation controller owns its 200ms timer
and input lifecycle; bootstrap injects timing and movement tolerance. Shared auto-switches allow unavailable
activation only when their header consumer explicitly opts in; other consumers keep disabled behavior.

## Verification

Existing inventory-integration scenarios cover both kinds and list-visible states, first activation, changed
target, missing candidate, exactly-one consumption, completion and no candidate. Inventory UI verifies that
the submitted ID follows the current displayed order, including an order change after render. Both checks
failed before the implementation and pass after it. Added equipment/inline-editor repeat, cancel and missing
prerequisite scenarios. Existing task-interactions covers the exact hold deadline, mouse/touch, right-click,
movement/cancel/blur/stale DOM, synthetic-click suppression and disposal. Platform-runtime covers context menus
on UI controls. Remove the obsolete UI_EXCEPTIONS export and its test exposure; no tool or dependency is replaced.

Follow-up v0.45.32: automatic approval review became available. Full ran with 64/65 passing;
Pages requires this spec's new pick-cancel controller committed for its HEAD-based file list.
The owner marked TK-009/TK-010 accepted in tasks.md. No visual inspection by the agent.
