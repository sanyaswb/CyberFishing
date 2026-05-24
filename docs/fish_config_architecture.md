# Fish config architecture

`FISH_DB` is now an aggregator, not a storage file for every species.

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
  movementProfile: { agility: 1.1 },
})
```

Full explicit profiles are still valid when a fish does not fit a preset.

## Required profiles

Every fish must expose:

- `forceProfile`
- `staminaProfile`
- `movementProfile`
- `resistanceProfile`
- `retrieveProfile`
- `behaviorProfile.behaviors`

`FishPhysicsProfile` remains as a temporary runtime compatibility layer, but `FISH_DB.physics` must not store old flat aliases such as `basePower`, `speedForceMultiplier`, or `behaviors`.
