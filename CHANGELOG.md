# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.52.10 - Touch aim 1:1 with a smooth centre scroll; full-power start switch (TK-363.2, TK-365)

- On a touch screen the cast aim moves exactly as far as the finger moves, from where it was — it does not jump under the finger and is no longer a slow joystick. While aiming, the map scrolls toward the aim's side, faster the farther the aim is from the screen's middle (at most 450 px/s), speeding up and slowing down smoothly.
- Test switch casting.touchAim.startAtFullPower (on): an aim switched on by a tap waits at full power; a downward swipe lowers the power, back up raises it.

## v0.52.9 - Review fixes for God mode line (TK-364.1, TK-364.2)

- A line break in God mode no longer writes off more line than the tackle has: the 300 m reserve or a pole's virtual line is not lost, only the tackle's own line.
- DevTools: the God mode warning no longer rewrites its text on every live update; only a changed value updates it.

## v0.52.8 - God mode: a fish hooked far away stays in place; virtual reel for the pole (TK-364)

- With God mode infinite casting, a fish hooked beyond the tackle's normal line no longer jumps to the line's limit. A reel gets a 300 m line reserve. A pole keeps its own line and gets a virtual one beyond it: the fish takes it while you do not pull, and pulling winds it back (virtual reel, 1.5 m/s, slower under tension) down to the pole's own line.
- DevTools → DEBUG → godMode shows a warning with these values while infinite casting is on. Values in CONFIG.debug.godMode.infiniteCastingLine. Without God mode nothing changes.

## v0.52.7 - Touch aim: a still finger steers by screen half (TK-363.1)

- A still finger on the left half of the screen moves the cast aim left, on the right half right; the farther from the middle, the faster, and in the very middle it stays. Before, only a narrow band at the screen edge did this.

## v0.52.6 - Touch aim moves like a joystick (TK-363)

- On a touch screen the cast aim no longer jumps under the finger. A held sideways swipe from the touch point moves it, faster for a longer swipe; a still finger near a screen edge pushes it toward that edge; it speeds up and slows down smoothly, and the cast goes where the aim is. Mouse unchanged. Values in casting.touchAim.

## v0.52.5 - In God mode a cast no longer lands outside the castable zone (TK-362.2)

- With God mode on, its infinite-casting flag accepted any random point of the accuracy circle, land included, so a cast at the edge of the castable mask could land outside the green zone. The landing point is now always tested for water; God mode lifts only the distance limit (also for the legacy click cast). Game-cycle report unchanged.

## v0.52.4 - The tackle no longer gets stuck on land over a mask stair (TK-362.1)

- Near a stair of the castable zone's mask the tackle could step diagonally past the stair's corner onto land during drift, a bite or a fight, and then never move again. Each step is now tested where it ends, and a tackle that is off the water comes back when reeled in. Game-cycle report unchanged.

## v0.52.3 - Cast area: landings stay inside the castable zone (spec 183, TK-362)

- Checked the cast area: when the accuracy area crosses the edge of the castable zone, a point outside is refused and drawn again, so the tackle never lands outside (20 000 casts on the test map, none outside). A new check keeps it that way. No game change.

## v0.52.2 - Touch cast controls: scroll, tap to aim, no long-press re-cast (spec 183, TK-361)

- On a phone with a ready rod a sideways swipe now scrolls the map instead of aiming. A tap starts aiming: the aim waits until a touch pulls down with power and casts; a release at zero power keeps it, a tap or a double tap removes it. A long swipe down aims and casts at once. The mouse works as before.
- The long-press re-cast is gone for touch and mouse: reel the tackle in, double tap, cast. Game-cycle report unchanged.

## v0.52.1 - DevTools weather «Керування»: live switches, sliders when on (TK-360)

- «Стан і керування» is now «Керування». A strength slider shows under Дощ/Шторм/Туман/Викид/Зорепад only while it is on; «Болід зараз» is the last row and on a phone closes DevTools so the bolide is seen falling.
- «The fog comes on after the starfall goes off»: the switches showed the state of the last redraw. The starfall's test switch moves the clock to 23:00 (the fog's ×3 window), a fog started by itself and the next redraw revealed it. The switches now follow the live state while the panel is open. Game-cycle report unchanged.
