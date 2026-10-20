# Header bait removal by hold

Owner addition: 2026-10-21. Implementation: v0.45.34 together with the TK-011 acceptance fix.

Hold LMB on an equipped, unhighlighted bait icon in the header to return that portion to the backpack.
Owner correction v0.45.35: remove at 200ms from pointerdown, without the card activation delay. Show
a thin animated circular progress ring around the bait artwork without a shadow. Keep existing pointer
ownership and movement/cancel rules. A short click keeps selection/replacement. Empty icons and A do not remove bait.
An active green target still cancels its pick at 200ms; it cannot start the removal hold. Touch follows the
same existing primary-pointer controller. This addition binds only bait icons; chum gestures are unchanged.

The shared auto-switch accepts an injected optional hold controller/callback. Its slot owns the persistent
click-suppression flag so the native release click cannot re-open a pick after the same button becomes empty.
Only changed item/highlight/availability rebinds the gesture; stock updates retain artwork and handlers.
The existing controller accepts a per-binding activation delay and progress host. Cards and the header
reuse the `inventory-press` feedback block; the header artwork supplies compact ring appearance through CSS
custom properties. Artwork-only changes keep its progress node. Only an active countdown schedules RAF;
completion, movement/cancel, replacement, close and disposal cancel it.
Owner scope correction v0.45.36: the same 200ms duration and zero activation delay apply to every
inventory cell, including backpack/saved kits, equipment and editor cells. One controller default owns
the duration; equipped and header consumers reuse it. Existing click, movement/cancel and green-pick
priority remain unchanged. Cell actions retain their existing meaning.
Owner timing correction v0.45.38 supersedes the zero-delay behavior: all those cells wait 300ms
before showing progress, then fill it for 200ms (500ms total). Short release during the delay remains
a click. Movement/cancel/replacement/disposal cancel either phase. Green pick cancellation keeps its
separate existing 200ms contract. No extra progress frames run during the activation delay.
Header interactions are disposed on inventory close and restored on open.

Inventory commands resolve the live equipped-tackle target and validate the expected bait instance before
atomic detach. No UI-owned equipment state, new globals, auto-mode changes or save schema changes.
The prior hook/prepared-root fix remains part of the same delivered patch. Read-only projections stay pure.

Existing inventory-ui/integration checks cover exact hold deadline, short press, RMB, movement/cancel,
changed bait, in-place removal and release-click suppression, close/reopen, green pick priority, sibling
hook preservation, returning the portion to inventory and keeping A enabled. Owner checks index/dev in
portrait/landscape; no agent browser visual check. No replaced tool/helper/fixture/dependency to remove.
Platform's deterministic performance/Date-clock scenarios also cover the hidden 300ms delay, half-fill
at 400ms, the 500ms deadline, custom host ownership and complete listener/frame/timer/node disposal.

Full: 64/65 pass, including Architecture, Quick, inventory UI/integration and save round trips. The sole failure
is the prior Pages HEAD-based file list missing the uncommitted pick-cancel controller.
