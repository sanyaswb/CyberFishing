# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.52.17 - Review of the touch cast and the emission blur (TK-368)

- The touch cast settings (input.touchCast) and the touch aim settings (casting.touchAim) are now checked when the game starts: a wrong value (text, a negative number, out of range) is reported instead of passing silently, and the touch cast settings have names and descriptions in DevTools. Nothing changes in play.

## v0.52.16 - The emission blurs only the world by default (TK-324.4)

- The emission's blur now covers only the world by default (emission.screen.includeHud off): it is the cheaper WebGL filter of v0.52.15, and the HUD, buttons and windows stay sharp. Blurring together with the HUD stays available as the «Розмивати разом з HUD» switch.

## v0.52.15 - Emission blur of the world alone through WebGL (TK-324.3)

- With «Розмивати разом з HUD» (emission.screen.includeHud) off, the emission's blur of the world is now drawn by the WebGL scene at half resolution with two passes (emission.screen.blur.scene) instead of the browser's backdrop-filter at the screen's full resolution: the same pulses at a fraction of the cost. The darkening stays as it was. With the HUD blurred too, nothing changes.

## v0.52.14 - Full-power touch aim start off by default (TK-365.2)

- An aim switched on by a tap waits at power 0 again and a downward swipe raises the power; the full-power start stays as a DevTools switch (casting.touchAim.startAtFullPower).

## v0.52.13 - Double tap to the map's edge before aiming (TK-366.1)

- Without an aim, a double tap in the left or right half of the screen takes the camera at once to that edge of the map; no aim starts. While aiming, a double tap removes the aim as before.
- A finger's double tap may now have up to 450 ms between its two releases (input.touchCast.doubleTapMs); it was 300 ms, too short for a finger's hold and pause. Mouse unchanged.

## v0.52.12 - Double tap while aiming jumps to the map's edge (TK-366)

- While the touch aim waits, a double tap in the left half of the screen takes the camera at once to the map's left edge, in the right half to the right edge; the aim waits at the screen's middle. A single tap still removes the aim.
- A tap on an aim waiting at full power (casting.touchAim.startAtFullPower) now removes it as a tap should, instead of casting.

## v0.52.11 - Touch cast power only near the aim line (TK-363.3)

- A touch that begins within 25 px of the aim line (casting.touchAim.powerZonePx) sets both direction and power; a touch farther away only moves the aim, an accidental downward slip does not change the power, and its release keeps the aim without casting.

## v0.52.10 - Touch aim 1:1 with a smooth centre scroll; full-power start switch (TK-363.2, TK-365)

- On a touch screen the cast aim moves exactly as far as the finger moves, from where it was — it does not jump under the finger and is no longer a slow joystick. While aiming, the map scrolls toward the aim's side, faster the farther the aim is from the screen's middle (at most 450 px/s), speeding up and slowing down smoothly.
- Test switch casting.touchAim.startAtFullPower (on): an aim switched on by a tap waits at full power; a downward swipe lowers the power, back up raises it.

## v0.52.9 - Review fixes for God mode line (TK-364.1, TK-364.2)

- A line break in God mode no longer writes off more line than the tackle has: the 300 m reserve or a pole's virtual line is not lost, only the tackle's own line.
- DevTools: the God mode warning no longer rewrites its text on every live update; only a changed value updates it.

## v0.52.8 - God mode: a fish hooked far away stays in place; virtual reel for the pole (TK-364)

- With God mode infinite casting, a fish hooked beyond the tackle's normal line no longer jumps to the line's limit. A reel gets a 300 m line reserve. A pole keeps its own line and gets a virtual one beyond it: the fish takes it while you do not pull, and pulling winds it back (virtual reel, 1.5 m/s, slower under tension) down to the pole's own line.
- DevTools → DEBUG → godMode shows a warning with these values while infinite casting is on. Values in CONFIG.debug.godMode.infiniteCastingLine. Without God mode nothing changes.
