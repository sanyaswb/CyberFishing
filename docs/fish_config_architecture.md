# Fish config architecture

`FISH_DB` is an aggregator, not a storage file for every species.

## Structure

```txt
src/config/databases/fish/
  fish_db.js                 # public FISH_DB aggregation entry
  fish_categories.js          # category registry
  presets/
    fish_profile_factory.js   # deep merge helpers
    fish_profile_presets.js   # reusable physics archetypes
  species/
    peaceful_fish.js
    predator_fish.js
    rare_fish.js
    event_fish.js
```

## Adding a fish

Add a species object to the correct `species/*.js` file. Keep the public `id` stable.

Preferred physics creation:

```js
physics: createFishPhysicsProfile(FISH_PROFILE_PRESETS.smallPeaceful, {
  forceProfile: { basePower: 0.8 },
  movementProfile: { baseSpeed: 1.1, agility: 1.1 },
})
```

Full explicit profiles are still valid when a fish does not fit a preset.

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
