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
