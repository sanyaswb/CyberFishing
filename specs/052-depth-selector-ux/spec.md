# Feature Specification: Depth selection on the float and the cast limit line

**Created**: 2026-10-11 · **Status**: Implemented (owner checks the visuals) · **Kind**: UX (backlog G-005)

## Owner request (2026-10-11)
The vertical depth slider and the horizontal cast bar are replaced:
- A float button (emoji now, a float image later) shows the selected depth.
- Pressing it slides a vertical depth track down from under the float, with min and max marks.
- While the track is open, a dashed horizontal line across the map marks the farthest cast at the selected depth.
  The unreachable water above the line is dimmed slightly; the reachable water below stays as it is.
- The line moves with the depth. With a sliding float the line stays put but is still drawn.
- With the track closed, the map is clean. The cast bar is removed.

The owner reported that the slider did not respond and did not limit the cast. On desktop the native vertical
`<input type=range>` (8 px wide) worked with a mouse and changed the limit. On touch it is a hard target, and the
limit itself was invisible: a full-power cast always looked the same. The old bar also ignored the rod's cast power
coefficient, while the cast uses it.

## Change
- `DepthSelector` (platform/browser/ui) is rebuilt with DOM nodes instead of `innerHTML` and ids:
  - The float button shows the tackle icon and the depth value. `setIcon` takes the equipped float, or the jig on a
    spinning rod. An image can replace the emoji later.
  - The track is a 44 px wide touch target with pointer capture. The wheel and the keyboard also work
    (arrows ±0.1 m, PageUp/PageDown ±1 m, Home/End). It has `role="slider"` and the ARIA values.
  - The track opens closed on `show`. The float toggles it; Esc, `hide()` and a press outside close it.
  - A press on the game canvas while the track is open only closes it: the event is stopped, so no cast starts. Other
    UI receives its press normally.
  - `updateCastDistance` and the text input are removed.
- `ScoutingState`:
  - While the track is open, it writes `casting.depthLimit` into the render intent. This is the same limit a
    full-power cast uses (`getEffectiveCastDistance`: depth budget × rod cast power coefficient), bounded by the
    location, plus the distance in metres.
  - The old cast bar sync is removed.
- `CastingRenderFrameBuilder` eases the displayed line toward the target (`casting.depthLimit.easeMs`, default 70 ms)
  and fades it in (`fadeInMs`, 180 ms). The label "закид до X м" is rebuilt only when the shown 0.1 m value changes.
  `CastSceneRenderer` dims the water above the line, draws the dashed line and the label, clipped to the castable
  water.
- `HUD_LABELS`: `depthValue`, `depthToggle`, `depthTrack`, `castLimit`; the cast bar labels are removed.
- `depth-selector.css` is rewritten (slide-down via clip-path/opacity/transform; `prefers-reduced-motion` respected).

## Evidence
- `platform-runtime` check rewritten for the control's behavior (owner rule 2026-10-11: no visual assertions):
  - closed after show, a closed track ignores presses, the float toggles;
  - drag, keys and wheel give the 0.1 m changes `[2.6, 5, 0.1, 5, 4.9, 3.9, 0.1, 0.2]`;
  - a canvas press closes the track and is consumed once; a closed track and other UI pass presses through;
  - Esc, `updateMax` clamping, `hide`, idempotent dispose that removes the document listener, re-entrant dispose.
- Game-cycle report unchanged (`7b9baea3…ed5b6`). Architecture 2/2, Quick 13/13, Full 39/39.
- Browser (Claude, built-in browser, dev.html; behavior only, read through the DOM):
  - the float opens the track (`aria-expanded` true);
  - a real mouse drag sets 4.9 m, then 2.0 m, and the button shows the value;
  - a tap on the water closes the track without casting; 0 console errors.
  - A cast with the track closed reached the game (a bite was logged).
  - Later casts did not start because the bait had been eaten; Claude's automated inventory clicks did not re-bait the
    hook. The owner re-baits in the inventory before checking.
