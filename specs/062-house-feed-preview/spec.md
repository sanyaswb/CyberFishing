# House feed preview and stable desktop menu

Owner instructions: 2026-10-14, including the compact-text/equal-height follow-up. Updates the UI interaction in spec 061; its additive feeding, half-time gate, inventory transactions and v5 migration continue unchanged.

## Feed row

- Remove the separate active-feed heading/row. One control row holds the feed/load action on the left and the current/draft item on the right.
- Preview and available items use one row creation/update path in `AquariumFeedPicker` and one `house__feed-item` style. Both include artwork, pack quantity and name. The active preview adds only a short countdown; its accessible name retains the explanatory duration.
- The action and preview stretch to the same control-row height. Warnings remain below that row, including the 50% gate explanation; warnings never enlarge the item itself.
- Choosing an inventory row closes the list without clearing the draft or consuming stock. The main action is Load. Clicking the preview toggles the same list so the draft can be changed before confirmation.
- A disabled action is labelled Load when there is available reserve feed. Active actions retain the existing choose-then-load workflow. The service remains authoritative for loading and locking.
- Successful confirmation focuses the visible warning below the row when the action becomes disabled. Stock changes, rejected commands, Escape and component disposal/remount retain their existing lifecycle guarantees.

## Buttons and icons

House install/upgrade buttons fit content with shared padding in landscape; only portrait stretches them to their container width. The feed/action row retains its two-column placement. Aquarium upgrade shows the target level and capacity as two icon/number pairs. `assets/ui/status-icons.svg` supplies the same glyphs for upgrade and status headers, with one `currentColor` style and accessible text names.

## Desktop menu

The shared sheet handle exposes `--ui-sheet-handle-hover-background`; the House dock sets it to transparent while retaining drag/tap and keyboard focus behavior. A mouse entering a menu button under the adapter's desktop-hover policy holds the button-container minimum height until the pointer leaves the dock. Moving through a gap or the handle preserves the hold; entering the handle alone does not start it. Touch and disabled hover policies cannot acquire this state. Its minimum-height transition starts at the same compact height as button height, preventing a brief shrink during an early move off the button. Panel/zone changes and disposal clear the transient state and its pointer listeners.

## Reuse and verification

The UI catalog imports production HTML and uses the production picker, HouseView, icon sprite and styles. No separate row, icon paths, hover controller or feeding formula is maintained in DEV.

The focused picker regression first failed because selection left the list open. Updated checks cover selection/closing/reopening without consumption, compact countdown, external warning, disabled Load label, stock changes, failed retry, stable row images and remount. House checks cover numeric upgrades and mouse movement button→gap→handle→outside, touch/hover-policy rejection, one state write across 100 pointer-over events, and listener cleanup/remount.

Validation: focused House/live-bait/catalog/navigation checks pass; Architecture 4/4, Quick 25/25 and Full 51/51 pass. Console checks on index, DEV, House, DEV House and UI catalog have no errors/warnings. Browser verification is limited to console; the owner performs visual and browser-input acceptance. No screenshot or browser-input tests were run.
