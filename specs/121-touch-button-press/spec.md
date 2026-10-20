# TK-012 — Transient touch press feedback

Owner request: 2026-10-20. Implementation: v0.45.32; owner visual acceptance pending.
The current tasks.md moves DevTools restructuring to TK-013; its old subpoint numbers are corrected.

Touch/non-hover UI controls use native CSS :active for the duration of a press. Share declarations with
desktop hover where available, keeping desktop capability gating intact. Cover the shared HUD/menu and
toolbar (net, chum, inventory and float), close/handle/switch, inventory action/category/sort/item/socket,
section tabs, keepnet, House and DEV controls. Release/cancel restores the normal appearance; selected,
expanded, aiming and keyboard focus states retain their meaning. Disabled native controls do not light up.
House dock press changes only its background, leaving its existing hold-to-open navigation in charge.
Do not resize hit targets, simulate sticky hover, filter artwork, add input listeners or poll the DOM.

Each component stylesheet owns its press state under .ui-surface:not(.ui-surface--desktop-hover).
This also handles touch laptops and small/portrait surfaces using the existing UiSurfaceAdapter policy.
The CSS policy guard accepts only scoped native active decoration in this branch and still rejects
hover there, including a combined active:hover selector. Desktop gating and the other safety checks remain.
Existing motion contracts apply; help and DEV metric transitions also respect reduced motion.

Focused CSS/inventory UI checks pass. Full ran: 64/65 pass; Pages requires the prior pair's new controller
to be committed for its HEAD-based file list. No browser visual inspection
by the agent: owner checks index/dev in portrait/landscape, press/hold/release, drag/cancel, disabled buttons,
hybrid input and reduced motion. No replaced tool/helper/fixture/dependency to remove.
