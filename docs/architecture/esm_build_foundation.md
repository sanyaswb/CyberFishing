# CyberFishing ESM Build Foundation

Stage 1.8.2 proves that the repository can accept `.js` ES modules while CyberFishing itself remains on the unchanged classic-script runtime.

## Boundaries

```text
NativeEsmFixtureRunner
  → JavaScript ESM semantics only

ViteFixtureBuildCheck
  → synthetic build infrastructure only
```

The fixture boundary is `utils/architecture/esm-fixtures/`. Its local `package.json` sets `"type": "module"`; the root package remains CommonJS-compatible for repository tooling.

Vite uses an explicit programmatic build with `configFile: false`, `publicDir: false`, and the synthetic `fixture-entry.js` as its only entry. Output is written below the operating-system temporary directory, inspected, and removed after every check.

## Explicitly excluded

- `index.html` is not a Vite input.
- `src/` is not part of the fixture graph.
- `assets/` is not part of the fixture graph.
- No `game.entry.js` or `dev.entry.js` exists.
- Vite does not serve or bundle the current game.
- No custom legacy-script loader is introduced.

## Acceptance evidence

- Native fixture: static imports, named exports, literal dynamic import, explicit `.js`, and no new global properties.
- Vite fixture: every concrete Rollup module remains inside the fixture root.
- Repository membership and hashes remain identical before and after the build.
- Browser smoke: 424 classic scripts, zero module scripts, one Canvas, version `v0.24.30`, and no console errors.
