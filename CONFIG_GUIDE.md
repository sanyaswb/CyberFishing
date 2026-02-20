# Fishing Game Configuration Guide

All game settings have been centralized in `config.js` for easy customization. Simply edit the `CONFIG` object in that file to adjust any game parameters.

## Configuration Sections

### Canvas Settings
Controls the rendering canvas appearance:
- `width`: Canvas width in pixels (default: 800)
- `height`: Canvas height in pixels (default: 600)
- `id`: HTML element ID for the canvas (default: 'gameCanvas')
- `backgroundColor`: Canvas background color (default: '#0f171e')

### Viewport Settings
Defines the play area boundaries (in pixels from edges):
- `marginLeft`: Left boundary offset (default: 50)
- `marginRight`: Right boundary offset (default: 50)
- `marginTop`: Top boundary offset (default: 50)
- `marginBottom`: Bottom boundary offset (default: 50)

### Input Settings
Controls player input behavior:
- `pointerThreshold`: Minimum drag distance (pixels) to register left/right direction (default: 20)

### Float/Bobber Settings
Customizes the fish float appearance and physics:
- `initialX`: Starting X position (default: null = canvas center)
- `initialY`: Starting Y position (default: null = canvas center)
- `size`: Cross-hair size (default: 15)
- `circleRadius`: Circle glow radius (default: 20)
- `friction`: Velocity dampening (0-1, default: 0.85)
- `color`: Float color (default: '#00ff80' = green)
- `circleColor`: Circle glow color (default: 'rgba(0, 255, 128, 0.2)')

### Rod Settings
Defines the player's fishing rod:
- `level`: Rod level multiplier (default: 5)
- `basePower`: Rod base power (default: 2.0)
- `lineColor`: Fishing line color (default: '#4a5b6c')
- `lineWidth`: Fishing line thickness (default: 2)
- `baseX`: Rod position X (default: null = canvas center)
- `baseY`: Rod position Y (default: null = canvas bottom)

### Reel Settings
Defines the fishing reel:
- `level`: Reel level multiplier (default: 3)
- `basePower`: Reel base power (default: 1.5)

### Fish Settings
Customizes the fish behavior:
- `level`: Fish level (default: 10)
- `weight`: Fish weight (default: 5)
- `resistance`: Fish resistance value (default: 80)
- `behaviorTimerMin`: Minimum time before fish changes direction (ms, default: 200)
- `behaviorTimerRandom`: Random range added to behavior timer (ms, default: 500)
- `angleOffset`: Fishing direction bias (default: 0.5)

### Physics Settings
Controls force multipliers:
- `fishForceMultiplier`: Scales fish force applied per frame (default: 0.01)
- `playerForceMultiplier`: Scales player force applied per frame (default: 0.05)

### Tension Meter Settings
Comprehensive tension display customization:

#### Calculation
- `sensitivityMultiplier`: How quickly tension changes (default: 0.02)
- `smoothApproach`: Tension smoothing speed (0-1, default: 0.15)

#### Pulse Effect
- `pulseSpeedBaseMultiplier`: Pulse animation speed (default: 0.05)
- `pulseSpeedMax`: Maximum pulse frequency (default: 10)
- `pulseTensionDivisor`: Divide tension by this for pulse calculation (default: 10)
- `pulseMagnitude`: Pulse intensity (0-1, default: 0.5)

#### Bar Display
- `barWidth`: Tension bar width (pixels, default: 300)
- `barHeight`: Tension bar height (pixels, default: 20)
- `barYOffset`: Distance from bottom (pixels, default: 40)
- `barBorderWidth`: Border thickness (default: 1)
- `borderPadding`: Space around bar (default: 2)
- `backgroundColor`: Bar background color (default: '#1a2b3c')
- `borderColor`: Bar border color (default: '#4a5b6c')
- `glowIntensity`: Glow effect strength (default: 0.6)

#### Label Settings
- `labelFont`: Font style (default: 'bold 12px monospace')
- `labelColor`: Text color (default: '#8a9bac')
- `labelOffsetX`: Left/right spacing (default: 60)
- `labelOffsetY`: Vertical spacing (default: 16)

#### Status Thresholds
Each status has a threshold (%) and color. Format: `{ threshold, label, color }`
- Idle: 0% - gray
- LOW: 1%+ - cyan
- MEDIUM: 30%+ - yellow
- HIGH: 60%+ - orange
- CRITICAL: 80%+ - red

#### Color Gradient
Defines smooth color transitions for the tension bar fill:
- `low`: 0-33% tension (blue to yellow)
  - `start`: [0, 0, 255] (blue RGB)
  - `end`: [255, 255, 0] (yellow RGB)
- `mid`: 33-66% tension (yellow to orange)
  - `start`: [255, 255, 0] (yellow RGB)
  - `end`: [255, 128, 0] (orange RGB)
- `high`: 66-100% tension (orange to red)
  - `start`: [255, 128, 0] (orange RGB)
  - `end`: [255, 0, 0] (red RGB)
- `breakpoints`: { low: 33, mid: 66 }

### Colors
Global color references:
- `background`: Canvas background (default: '#0f171e')
- `bodyBackground`: Page background (default: '#1a1a1a')

## Usage Examples

### Adjust Difficulty
```javascript
// Make fish harder
CONFIG.fish.resistance = 150;
CONFIG.physics.fishForceMultiplier = 0.02;

// Make rod more powerful
CONFIG.rod.basePower = 3.0;
```

### Change Float Size
```javascript
CONFIG.float.size = 20;
CONFIG.float.circleRadius = 30;
```

### Modify Tension Bar
```javascript
CONFIG.tension.barWidth = 400;
CONFIG.tension.barHeight = 30;

// Change color gradient
CONFIG.tension.colorGradient.high.end = [255, 100, 100]; // Lighter red
```

### Toggle Fish AI Aggressiveness
```javascript
// Make fish more erratic
CONFIG.fish.behaviorTimerMin = 100;
CONFIG.fish.behaviorTimerRandom = 300;

// Make fish more predictable
CONFIG.fish.behaviorTimerMin = 500;
CONFIG.fish.behaviorTimerRandom = 1000;
```

## Notes

- All colors use hex format: `'#RRGGBB'` or RGB: `'rgb(r, g, b)'` or RGBA: `'rgba(r, g, b, a)'`
- RGB arrays are formatted as `[red, green, blue]` where each value is 0-255
- Multipliers generally work on a scale of 0-1 for subtle effects, or higher for dramatic changes
- Fractions (0-1) are used for friction and smoothing values
- Pixel values are in canvas coordinate space (default 800x600)

--

## Overview

This guide documents the `CONFIG` object found in `config.js` and explains recent changes to the prototype's gameplay and systems. The configuration centralizes tuning for visuals, physics, and new mechanics (tension meter, stamina, and spatial penalties), so you can balance gameplay without editing engine code.

## What changed (summary)

- Centralized settings in `config.js`: all tunable constants live in one file for easy editing.
- Tension Meter: a visible, performant tension bar with caching and pulse animation; includes a line-break timer that triggers failure when tension stays too high.
- Stamina System: `FishStamina` and `StaminaController` model fish endurance; stamina depletes when player holds ideal tension and regenerates when slack or when float is at screen edges.
- Spatial Penalty / Edge Mechanics: fish power and stamina behavior scale with the float's horizontal position — the center is the "sweet spot" and edges amplify fish jerks while increasing edge regen for stamina.
- Renderer vs Logic separation: rendering reads cached visual values from logic classes (`TensionMeter`) to reduce per-frame allocations and keep the draw path fast.
- Minor UX: in-canvas overlays for "victory" and "line broken" states and a debug stamina bar for tuning.

## What is it

`CONFIG` is a single JavaScript object (file: [config.js](config.js)) that contains every tunable parameter the prototype uses. It is the single source of truth for gameplay, visual styling, and physics multipliers.

## What is it for

- Rapid iteration: tweak gameplay without changing implementation.
- Balancing: adjust fish difficulty, rod/reel power, tension sensitivities, stamina rates, and spatial behavior from one place.
- Portability: keep engine code generic while exposing gameplay variables for designers.

## How it works (high level)

- Game loop: `index.html` runs an update → draw loop. Update steps compute player input, fish chaotic force, apply forces to the float, then update the tension and stamina systems. Draw steps render the float, rod line, tension bar, stamina debug bar, and overlays.

- TensionMeter (logic): receives the vertical components of player force and fish force, integrates a smoothed tension value, advances a pulse phase for visual rhythm, and manages a line-break timer when tension exceeds `tension.breakThreshold`. It caches a single color/status string per visual update so the renderer only reads ready-made values.

- FishStamina + StaminaController: `FishStamina` stores current/max stamina and supports `applyDamage`/`applyRegen`. `StaminaController.evaluate(...)` decides whether to regen or damage based on the current tension band (slack, optimal, outside). Damage in the optimal band scales with player pull power, distance from the perfect tension, and the spatial penalty (edges reduce effectiveness). Edges also grant increased regen via `edgeRegenRate`.

- Spatial Penalty: both fish power and stamina calculations use a normalized spatial penalty computed from the float's X position. The center region (configurable via `centerSweetSpot`) reduces the penalty; farther toward edges increases `spatialPenalty` (0..1). Fish dynamic power is multiplied by `(1 + spatialPenalty * fish.edgePowerMultiplier)` to produce stronger, jerky behavior near edges.

- FishingSystem responsibilities: computes player force (rod+reel+buffs) and fish force (chaos vector scaled by dynamic power). `calculateFishForce(dt, floatX, bounds, config)` now accepts float X and play bounds to compute spatial effects.

## Key config keys added or affected

- `tension.breakThreshold`, `tension.breakTimeout` — when tension is above the threshold for the configured timeout, the line breaks.
- `tension.colorGradient`, `tension.statuses` — control bar coloration and textual status labels.
- `stamina` (section)
  - `fish.baseStaminaMultiplier`, `fish.flatBonus` — base stamina formula: `(level * weight * baseStaminaMultiplier) + flatBonus`.
  - `mechanics.slackThreshold` — tension under this value is considered slack (regen zone).
  - `mechanics.optimalMin`, `optimalMax` — tension window where stamina depletes when the player pulls correctly.
  - `mechanics.perfectTension` — ideal tension value inside the optimal band; distance from this reduces depletion efficiency.
  - `mechanics.baseDepletionRate`, `baseRegenRate` — rates used by `StaminaController` to hurt/heal stamina (units per second before scaling).
  - `mechanics.centerSweetSpot` — fraction of the play width around center before spatial penalty begins (0..1). Smaller means smaller sweet spot.
  - `mechanics.edgeRegenRate` — additional regen applied at edges (scaled by how close to the edge).

- `fish.edgePowerMultiplier` — scales how much stronger fish behavior becomes at edges.

## Tuning recommendations

- If players break the line too often: increase `rod.basePower` or `reel.basePower`, reduce `tension.sensitivityMultiplier`, or increase `tension.breakTimeout`.
- If stamina depletes too quickly: reduce `stamina.mechanics.baseDepletionRate` or widen `mechanics.optimalMin/Max` away from `perfectTension`.
- To make edges more punishing visually: increase `fish.edgePowerMultiplier`. To encourage edge play (regen), increase `mechanics.edgeRegenRate`.

## How to test changes quickly

1. Edit [config.js](config.js) values in a code editor.
2. Open `index.html` in a browser (double-click or host locally). The canvas loads `config.js` and applies changes immediately on refresh.
3. Watch the tension bar at the bottom and the stamina debug bar at the top (debug); use keyboard (arrow keys / space) or pointer to interact.

## Next steps and notes

- The prototype includes a debug stamina bar for tuning. For release, you may hide it or add a polished UI widget.
- Consider adding an in-page restart button (non-reload) for faster playtesting; I can implement that on request.
- The separation of logic (TensionMeter, StaminaController) from rendering reduces per-frame allocation and makes this code easier to port to WebGL or a game engine.

If you want, I can also add a short "quick balance presets" section with suggested config sets (easy/normal/hard). Tell me which presets you'd like.
