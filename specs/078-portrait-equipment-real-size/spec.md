# Portrait equipment sized from its real row

Owner report: 2026-10-15, screenshot at 558 × 858: without a rod the stretched rod cell runs under the auxiliary row.

Cause: in portrait the equipment unit was estimated from the viewport,
`(logical height - width * 0.15 - 96px) / 4.56`, assuming a fixed header and tab height. Spec 072 added the load row
to the header, so the estimate exceeded the real row. The rodless rod cell keeps the reference height as its minimum
(spec 070 follow-up) inside a `minmax(0, 1fr)` track, so it overflowed under the auxiliary wells; with a rod the
composition overflowed into scrolling.

Change: in portrait the equipment host (`inventory-modal--section-equipment .inventory-main__left`) is a size
container and the loadout keeps the base unit `min(100cqi / 3.66, 100cqb / 4.56)`, as in wide layouts. The
composition (and the rodless minimum) always fits the actual row between the header and the tabs at any header
height; the rod cell stays within the reference width. The viewport estimate is removed, and the inventory UI check
rejects equipment sizes that estimate the header from the viewport.

No gameplay, save or formula changes. Verification: inventory UI check, CSS usage, Architecture, Quick, Full. Owner
visual acceptance; no browser testing by Claude.
