# Phone item editor: second round of fixes

Owner review on the phone, 2026-10-16. No version bump until the owner's command.

## Changes

1. **Artwork centred in every tab.** A tab's card or cell fills the cell square inside the tab's inset, so its artwork
   is centred in that square, active (wider, taller) or not. A rod skin thumbnail, bottom-cropped elsewhere (spec 071),
   is shown whole (`contain`) and centred in a tab. Measured at 360 x 740: every image's centre matches its square's
   centre; tabs keep the cell size (66 px), the row stays full (338 px).
2. **No scales in tabs.** Cell tabs render without resource meters (`renderSlot` gains `showResourceMeter`); the
   values remain in the parameter panel.
3. **Larger inset.** Tabs have an inset of 14% of the cell size between their edges and the artwork
   (`--inventory-editor-tab-inset`).
4. **A tap scrolls to the tabs.** Every tap on a tab with an item (root, filled cell, view-only), the already active one
   included, shows its parameters and scrolls the editor so the tab row meets the top of its scroller; a short page
   stops at the bottom of the parameters (the browser clamps the target), so the tabs always stay in view. Swipes and
   keys only switch the page. `ScrollContainerAligner` (platform) finds the nearest vertical scroller, scrolls smoothly
   unless the viewer prefers reduced motion, and measures only on a tap.

## Verification

Inventory UI check: the aligner's target and behaviour (smooth/reduced), existing tab scenarios. CSS usage,
Architecture, Quick, Full; game-cycle unchanged. In-app browser at 360 x 740 (computed geometry only): centred images,
66 px tabs, full row, a tap on a filled tab scrolls to the clamped end when the page is short.
