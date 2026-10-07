# Fish config architecture

`FISH_DB` is an aggregator, not a storage file for every species.

## Structure

```txt
src/game/config/raw/fish/        # authored species data (no imports)
  peaceful_fish.js
  predator_fish.js
  rare_fish.js
  event_fish.js
src/game/config/databases/
  fish/fish_categories.js         # category registry
  fish_database.js                # public FISH_DB aggregation
```

## Adding a fish

Add a species object to the correct `src/game/config/raw/fish/*.js` file. Keep the public `id` stable.

Each species declares its physics profile explicitly.

## Required fight profiles

Every fish must expose:

- `forceProfile.basePower`
- `staminaProfile`
- `movementProfile.baseSpeed`
- `behaviorProfile.behaviors`

Each behavior state must use:

- `forceMultiplier` for active force/tension;
- `speedMultiplier` for movement speed only.

Do not store old fight fields in `FISH_DB.physics`:

- `resistanceProfile`
- `retrieveProfile`
- `minPowerRatio`
- `maxSpeedMetersPerSec`
- `speedForceMultiplier`
- `waterResistanceMultiplier`
- `powerRatio`
- `speedRatio`
