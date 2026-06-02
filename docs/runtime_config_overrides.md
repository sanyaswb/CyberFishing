# Runtime config overrides

DevTools no longer treats the original config as the mutable source of truth.

## Layers

```txt
BASE_CONFIG          immutable snapshot of startup CONFIG
CONFIG_OVERRIDE_STORE runtime-only path/value overrides
CONFIG               resolved runtime object used by existing systems
```

`BASE_CONFIG` is deeply frozen. DevTools writes to `CONFIG_OVERRIDE_STORE` and then applies the resolved value to the runtime `CONFIG` object so current gameplay systems can keep reading `CONFIG` without a large rewrite.

## API

```js
CONFIG_RUNTIME_CONTEXT.set(
  "physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed",
  1.2,
);

CONFIG_RUNTIME_CONTEXT.reset(
  "physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed",
);

CONFIG_RUNTIME_CONTEXT.exportOverrides();
CONFIG_RUNTIME_CONTEXT.importOverrides(json);
CONFIG_RUNTIME_CONTEXT.resetAll();
```

## DevTools

The DevTools panel exposes:

- active override count;
- reset all overrides;
- export overrides;
- import overrides.

Parameters changed through DevTools are marked with `*` in the config tree.
