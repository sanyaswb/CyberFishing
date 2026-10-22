# Scoped DEV export and a confirmed import of zones into the code

Owner request, 2026-10-22. Status: specified; owner approval of the decisions below pending, not implemented.
DEV and tooling only: production never composes the export, and the game reads the same zone data as before.

## Request

Make export in DevTools more flexible. Exporting the zone settings downloads a JSON file that contains only the zones,
not the whole config. Then import that file into the code safely: a script with confirmation, a conflict check and a
backup of what it replaces.

## Findings (verified in the code, v0.46.21)

- **One export for everything.** DevTools "Export overrides" (section "Сервіс") and the zone editor's export call
  `DevTools.#exportRuntimeOverrides`: every runtime override of the whole config as one JSON object keyed by dotted
  paths (`locations.map.test.zones.castable`, `fishing...`), shown in `window.prompt` and copied to the clipboard.
  Nothing is downloaded as a file; the content depends on whatever else was edited in the session.
- **Overrides only.** The export holds the changed paths, not the zones as a whole. A zone list that was not touched is
  missing, so the file alone cannot say what the zones of a location are.
- **Edits live in memory.** `ConfigOverrideStore` keeps overrides in memory only; nothing persists them. A page reload
  loses every zone edit that was not exported.
- **Zones sit inside a hand-written module.** `MAP_DB.test.zones` is an object literal inside
  `src/game/config/raw/locations/location_database.js` (81 lines, comments, backgrounds, weather, environment). A script
  cannot rewrite one branch of that literal safely without a JS parser, and a regex rewrite would break on comments
  or formatting.
- Zones are authored in design cells (`CONFIG.locations.designCellSize` 40, `baseResolution` 2560 x 1440); dynamic
  zones also carry `id`, `type`, `multiplier`, `moving`, `speedX/Y` and `bounds` in map pixels.

## Decisions (recommended; owner approval pending)

- **D1 Scope.** The first export scope is the zones of one location. Further scopes (the location's
  `waterProjection`, cell sizes) can be added to the same registry later without changing the zone format. Owner
  question Q1: only zones now, or zones and perspective together?
- **D2 Zone data module.** Each location's zones move into a data-only module
  `src/game/config/raw/locations/zones/<locationId>.js` (`export const ZONES = { castable: [...], collisions: [...],
  snags: [...], dynamic: [...] };` with a fixed header comment). `location_database.js` imports it as `zones: ZONES`.
  The bytes the game reads do not change, so the game-cycle report stays the same. The module stays editable by hand;
  the script reads it by importing it (no regex) and writes it whole in one canonical form (two-space indent, LF,
  fixed key order `id, type, multiplier, x, y, w, h, adaptiveX, moving, speedX, speedY, bounds`, then any other keys
  alphabetically), so a script write gives a small, readable Git diff. Owner question Q4: agree to move the zones?
- **D3 Export file.** The zone editor's "Експорт зон" downloads (a Blob link, no clipboard prompt) the file
  `zones-<locationId>-v<version>-<yyyymmdd-hhmm>.json`. One location per file (owner question Q2):

  ```json
  {
    "format": "cyber-fishing/zones",
    "formatVersion": 1,
    "gameVersion": "0.46.21",
    "locationId": "test",
    "designCellSize": 40,
    "baseResolution": { "width": 2560, "height": 1440 },
    "exportedAt": "2026-10-22T18:40:00.000Z",
    "baseHash": "sha256 of the canonical code zones the session started from",
    "zones": { "castable": [], "collisions": [], "snags": [], "dynamic": [] }
  }
  ```

  `zones` is the full current list of every category (code value plus the session's edits), not a diff. `baseHash`
  is the SHA-256 of the canonical JSON of the zones in the code (`CONFIG` base, before overrides), so the importer can
  tell whether the code changed after the export. The hash uses Web Crypto in the browser and `node:crypto` in the
  script over the same canonical serialisation (one shared module in `src/dev/location/`, imported by both).
- **D4 Import script.** `npm run apply:zones -- <file.json> [--yes] [--force]` (`utils/apply-zones.js`):
  1. **Validate** the file: `format`/`formatVersion`, a known `locationId`, the same `designCellSize` and
     `baseResolution` as the code, every zone with finite `x, y` and `w, h > 0`, unique dynamic `id`s, `bounds` as
     rectangles. Any error stops with the field path; nothing is written.
  2. **Refuse a dirty target**: if the zone module has uncommitted changes (`git status --porcelain -- <file>`), stop,
     so a hand edit is never overwritten.
  3. **Detect a conflict**: if the hash of the current code zones differs from `baseHash`, the code changed after the
     export. Stop and print both sides' changes against each other per zone (`castable 1: x 0 -> 2`); `--force` applies
     the file anyway, after the same confirmation.
  4. **Show the change**: zones added, removed and changed (per field) by category. No change: report it and exit.
  5. **Confirm**: `Застосувати до src/.../zones/test.js? (y/N)`; `--yes` skips the question (for a scripted run).
  6. **Back up** the replaced module to `.git/cyber-fishing-backups/zones/<yyyymmdd-hhmmss>-<locationId>.js` (outside
     tracked source, never released; owner question Q3: or `D:/dev/cyber fishing/backups/`), and print the command that
     restores it.
  7. **Write** the module in its canonical form, then run `node utils/run-checks.js --check config-schema` and
     `--check game-cycle` and print their result. The script never commits or pushes; the owner commits.
- **D5 Back in the browser.** After an import the code holds the new zones, but a still-open DEV page keeps its
  in-memory overrides of the same paths. The zone editor gets "Скинути зміни зон до коду" (resets the location's
  `zones.*` overrides through the existing `configRuntime.reset`), and its status row says whether the session's
  zones differ from the code. The script's last line reminds to reload the page or press that button.
- **D6 Existing export stays.** "Export overrides" / "Import overrides" in "Сервіс" keep working for the whole
  session; the zone editor's buttons become the scoped ones. A dev-server endpoint that writes the code straight from
  the browser is out of scope: it would make a local server write project files, and the script keeps every write
  visible and confirmed. Its validation and canonical writer could be reused later.

## Tasks

- **T1** Shared zone serialisation in `src/dev/location/zone_export_format.js`: canonical key order, canonical JSON,
  SHA-256 hash (async, injected digest: Web Crypto or `node:crypto`), file envelope build and validation.
- **T2** Move `MAP_DB.test.zones` to `src/game/config/raw/locations/zones/test.js` in canonical form; import it in
  `location_database.js`. Game-cycle report unchanged; production structure gains one module (`npm run struct`).
- **T3** Zone editor "Експорт зон": download the envelope of the current location (Blob + `a[download]` through the DEV
  document port), replacing its overrides prompt; the console logs the file name.
- **T4** Zone editor "Імпорт зон": pick a `.json` file, validate it, apply its zones as session overrides (to continue
  editing an exported file in the browser), report errors in the status row.
- **T5** "Скинути зміни зон до коду" and a status row "зони збігаються з кодом / змінено N категорій" (D5).
- **T6** `utils/apply-zones.js` + `package.json` script `apply:zones` (D4), with its canonical writer.
- **T7** Checks: extend `zone-editor` (export envelope, hash stability, import into overrides, reset) and add a tooling
  check for the script (valid file applied with `--yes` into a temporary copy of the module; invalid file, dirty
  target, conflict, no-change and backup paths). The script check works in a scratch directory, never on `src/`.
- **T8** Docs: `docs/architecture.md` (zone data modules, DEV export), DEVELOPMENT_RULES or the zone editor info text
  on the workflow (edit in DevTools -> export -> `npm run apply:zones` -> review the diff -> commit). Utils cleanup
  step: remove anything this spec made unused.

## Checks

- Game-cycle report unchanged (the zones only move between modules).
- Hash: the same zones give the same hash in the browser and in Node, whatever their key order.
- Round trip: export -> `apply:zones --yes` -> the module re-exports the same zones -> the same hash; a second apply
  reports no change.
- Safety: a dirty target, a hash conflict without `--force`, a wrong `designCellSize` or a broken zone write nothing.
- Full run once at the end.

## Owner questions

- **Q1** Scope: only zones now (recommended), or zones and the location's perspective in the same file?
- **Q2** One location per file (recommended) or every location in one file?
- **Q3** Backups: `.git/cyber-fishing-backups/` (recommended: local, never released, removed with the clone) or
  `D:/dev/cyber fishing/backups/` next to `CHANGELOG_ARCHIVE.md`?
- **Q4** Move the zones out of `location_database.js` into `zones/<locationId>.js` (recommended; needed for a safe
  script write)?
- **Q5** Edits are lost on reload today (memory-only overrides). Keep it so (the export file is the save), or also keep
  the zone editor's edits in the browser's local storage until exported or reset?
