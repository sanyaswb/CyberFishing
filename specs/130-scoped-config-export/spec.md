# Location editor: zones bound to a location, scoped export and a confirmed import into the code

Owner request, 2026-10-22. Status: owner accepted Q1–Q6 as recommended (2026-10-22); implemented in v0.46.22; owner check pending.
DEV and tooling only: production never composes the editor, the export or the import, and the game reads the same
zone data as before.

## Request

1. Make export in DevTools more flexible. Exporting the zone settings downloads a JSON file that contains only the
   zones, not the whole config. Then import that file into the code safely: a script with confirmation, a conflict
   check and a backup of what it replaces.
2. (Owner, same day) Rename the DevTools section "Редактор зон" to "Редактор"; inside it put the list of LOCATIONS
   first, and after choosing a location, edit and save that location's zones, so every edit is bound to a location.

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
- **The location is chosen once, at startup.** `CurrentLocation` takes `player.locationId`, else
  `locations.currentLocationId`, else the first `MAP_DB` key; `GameCompositionRoot.#composeLocation` preloads it and
  builds one `LocationMap`. Nothing switches the location at runtime (`GameApplication.#reloadLocationConfig` only
  reloads the same id after a config edit).
- **The editor has an implicit location.** `ZoneEditorGeometryBuilder` sets `state.locationId` to the loaded map's id;
  the section and the drag tool fall back to `currentLocationId` or the first key. There is no way to choose one, and
  the lists would silently follow whatever location the page started with.
- `MAP_DB` holds one location today (`test`, "Test Waters"). DEV page parameters today: `scene`, `screen`.
- Zones are authored in design cells (`CONFIG.locations.designCellSize` 40, `baseResolution` 2560 x 1440); dynamic
  zones also carry `id`, `type`, `multiplier`, `moving`, `speedX/Y` and `bounds` (also design cells:
  `LocationMap.#scaleZones` scales them with the zones; the editor's "bounds — пікселі карти" note and its bounds
  outline, drawn unscaled, were wrong and are fixed here).

## Decisions (owner: Q1–Q6 as recommended, 2026-10-22)

- **D1 Location-bound editor.** The DevTools section "🗺️ РЕДАКТОР ЗОН" becomes "🗺️ РЕДАКТОР". Its first row is
  "Локація", a select of every `MAP_DB` location (`<name> (<id>)`). The chosen id is `ZoneEditorState.locationId`, the
  one source for every per-location part below it: "Редактор" (enable, background), "Зони для редагування", "Зони"
  (the category lists), "Сітка перспективи" (the location's `waterProjection`) and the new "Збереження" (D5). "Сітка
  клітинок" and "Оверлеї гри" stay in the section but are marked "спільне для всіх локацій" (they edit
  `CONFIG.locations`, not a location). The editable and hovered zone sets, the selection and the status are cleared
  when the location changes. By default the select shows the loaded location.
- **D2 Only the loaded location is drawn.** The map on screen is the location the page loaded; the editor draws and
  drags only while the chosen location is the loaded one. When another location is chosen, the lists and the
  export/import still work on its config, the map shows nothing of the editor, and a row says "На екрані: <loaded>.
  Відкрийте цю локацію, щоб редагувати на мапі" with the button "Відкрити локацію". The button reloads the DEV page
  with the new DEV parameter `dev.html?location=<id>`, which the DEV startup passes as the initial location id
  (production ignores it). Before reloading, if the session has zone edits that differ from the code, it asks
  (`window.confirm`) "Незбережені зміни зон буде втрачено. Експортуйте їх спочатку. Продовжити?". A runtime location
  switch without a reload is out of scope: it needs the world, the fishing session and the assets rebuilt (own spec).
- **D3 Scope.** The first export scope is the zones of one location. Further scopes (the location's
  `waterProjection`) can be added to the same registry later without changing the zone format. Owner question Q1.
- **D4 Zone data module.** Each location's zones move into a data-only module
  `src/game/config/raw/locations/zones/<locationId>.js` (`export const ZONES = { castable: [...], collisions: [...],
  snags: [...], dynamic: [...] };` with a fixed header comment). `location_database.js` imports it as `zones: ZONES` (implemented through a catalog, see Implementation).
  The bytes the game reads do not change, so the game-cycle report stays the same. The module stays editable by hand;
  the script reads it by importing it (no regex) and writes it whole in one canonical form (two-space indent, LF,
  fixed key order `id, type, multiplier, x, y, w, h, adaptiveX, moving, speedX, speedY, bounds`, then any other keys
  alphabetically), so a script write gives a small, readable Git diff. A new location gets its module the same way.
  Owner question Q4.
- **D5 "Збереження" of the chosen location.** A subsection with:
  - "Експорт зон" downloads (a Blob link, no clipboard prompt) `zones-<locationId>-v<version>-<yyyymmdd-hhmm>.json`:

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

    `zones` is the full current list of every category of that location (code value plus the session's edits), not a
    diff. `baseHash` is the SHA-256 of the canonical JSON of that location's zones in the code (the `CONFIG` base,
    before overrides), so the importer can tell whether the code changed after the export. The hash uses Web Crypto
    in the browser and `node:crypto` in the script over the same canonical serialisation (one shared module in
    `src/dev/location/`, imported by both). One location per file (owner question Q2).
  - "Імпорт зон" picks a `.json` file, validates it and applies its zones as session overrides, to continue editing an
    exported file in the browser. A file of another location is refused with "Файл для локації <id>; оберіть її у
    списку «Локація»".
  - "Скинути зміни зон до коду" resets the location's `zones.*` overrides through the existing `configRuntime.reset`.
  - A status row: "Зони збігаються з кодом" or "Змінено: <categories>"; after an import into the code the page's
    in-memory overrides may still differ, and the row shows it.
- **D6 Import script.** `npm run apply:zones -- <file.json> [--yes] [--force]` (`utils/apply-zones.js`). The target is
  the module of the file's `locationId`:
  1. **Validate** the file: `format`/`formatVersion`, a `locationId` that exists in `MAP_DB`, the same
     `designCellSize` and `baseResolution` as the code, every zone with finite `x, y` and `w, h > 0`, unique dynamic
     `id`s, `bounds` as rectangles. Any error stops with the field path; nothing is written.
  2. **Refuse a dirty target**: if the zone module has uncommitted changes (`git status --porcelain -- <file>`), stop,
     so a hand edit is never overwritten.
  3. **Detect a conflict**: if the hash of the location's current code zones differs from `baseHash`, the code changed
     after the export. Stop and print both sides' changes per zone (`castable 1: x 0 -> 2`); `--force` applies the
     file anyway, after the same confirmation.
  4. **Show the change**: zones added, removed and changed (per field) by category. No change: report it and exit.
  5. **Confirm**: `Застосувати до src/.../zones/<id>.js? (y/N)`; `--yes` skips the question (for a scripted run).
  6. **Back up** the replaced module to `.git/cyber-fishing-backups/zones/<yyyymmdd-hhmmss>-<locationId>.js` (outside
     tracked source, never released; owner question Q3) and print the command that restores it.
  7. **Write** the module in its canonical form, then run `node utils/run-checks.js --check config-schema` and
     `--check game-cycle` and print their result. The script never commits or pushes; the owner commits. Its last line
     reminds to reload the DEV page or press "Скинути зміни зон до коду".
- **D7 Existing export stays.** "Export overrides" / "Import overrides" in "Сервіс" keep working for the whole
  session; the editor's buttons are the scoped ones. A dev-server endpoint that writes the code straight from the
  browser is out of scope: it would make a local server write project files, and the script keeps every write visible
  and confirmed. Its validation and canonical writer could be reused later.

## Tasks

- **T1** Location binding (D1, D2): rename the section, the "Локація" select over `MAP_DB`, `ZoneEditorState`
  location change (clears editable/hovered/selection, bumps the revision), "спільне для всіх локацій" labels, the
  "На екрані" row and "Відкрити локацію" with the unsaved-edits confirmation, the DEV `?location=<id>` parameter in
  the DEV startup. Geometry and drag work only while the chosen location is the loaded one.
- **T2** Shared zone serialisation in `src/dev/location/zone_export_format.js`: canonical key order, canonical JSON,
  SHA-256 hash (async, injected digest: Web Crypto or `node:crypto`), file envelope build and validation.
- **T3** Move `MAP_DB.test.zones` to `src/game/config/raw/locations/zones/test.js` in canonical form; import it in
  `location_database.js`. Game-cycle report unchanged; production structure gains one module (`npm run struct`).
- **T4** "Збереження": "Експорт зон" (Blob + `a[download]` through the DEV document port; replaces the editor's
  overrides prompt), "Імпорт зон" (file input, location check, session overrides), "Скинути зміни зон до коду",
  the status row (D5).
- **T5** `utils/apply-zones.js` + `package.json` script `apply:zones` (D6), with its canonical writer.
- **T6** Checks: extend `zone-editor` (location select and clearing, drawing only for the loaded location, the
  reload URL and its confirmation, export envelope, hash stability, import into overrides and refusal of another
  location, reset, status) and add a tooling check for the script (valid file applied with `--yes` into a temporary
  copy of the module; invalid file, unknown location, dirty target, conflict, no-change and backup paths). The script
  check works in a scratch directory, never on `src/`.
- **T7** Docs: `docs/architecture.md` (zone data modules, DEV location editor, export), the editor's info text on the
  workflow (choose location -> edit -> "Експорт зон" -> `npm run apply:zones` -> review the diff -> commit). Utils
  cleanup step: remove anything this spec made unused.

## Checks

- Game-cycle report unchanged (the zones only move between modules).
- Hash: the same zones give the same hash in the browser and in Node, whatever their key order.
- Round trip: export -> `apply:zones --yes` -> the module re-exports the same zones -> the same hash; a second apply
  reports no change.
- Location binding: an export carries the chosen location; an import of another location's file changes nothing; a
  location change clears the editable set; the editor draws nothing while another location than the loaded one is
  chosen.
- Safety: a dirty target, a hash conflict without `--force`, an unknown location, a wrong `designCellSize` or a broken
  zone write nothing.
- Full run once at the end.

## Owner questions

- **Q1** Scope: only zones now (recommended), or zones and the location's perspective in the same file?
- **Q2** One location per file (recommended) or every location in one file?
- **Q3** Backups: `.git/cyber-fishing-backups/` (recommended: local, never released, removed with the clone) or
  `D:/dev/cyber fishing/backups/` next to `CHANGELOG_ARCHIVE.md`?
- **Q4** Move the zones out of `location_database.js` into `zones/<locationId>.js` (recommended; needed for a safe
  script write)?
- **Q5** Edits are lost on reload today (memory-only overrides). Keep it so (recommended: the export file is the save,
  and "Відкрити локацію" warns before reloading), or also keep the editor's edits per location in the browser's local
  storage until exported or reset?
- **Q6** Choosing another location: reload the DEV page with `?location=<id>` after the confirmation (recommended;
  only one location exists today), or a runtime location switch without reload (a separate, larger spec)?

## Implementation (v0.46.22)

- T1: `ZoneEditorState.locationId/loadedLocationId/setLocation/clearZoneMarks`; the section "🗺️ РЕДАКТОР" starts with
  "Локація" (select, "На екрані", "Відкрити локацію" with the unsaved-edits confirmation); the geometry builder and the
  drag tool work only while `editsLoadedLocation`; DEV `?location=<id>` sets `CONFIG.locations.currentLocationId`.
- T2: `src/dev/location/zone_export_format.js`. T3: `zones/test.js` (same bytes; game-cycle unchanged). Raw config may
  import nothing (architecture guard), so `game/config/databases/location_catalog.js` joins the zone modules to the raw
  `MAP_DB` (same identity, like `ITEM_DB`); `game_config.js` imports the catalog.
- T4: "Збереження" (status, "Експорт зон", "Імпорт зон", "Скинути зміни зон до коду"); `ZoneEditorBrowserPort`
  (Blob download, file pick, confirm, reload, Web Crypto); `DevTools.#resetLocationZones`. The editor no longer shows
  the whole-config override export (it stays in "Сервіс").
- T5: `utils/apply-zones.js`, `npm run apply:zones`. A new, untracked or edited module counts as dirty.
- T6: `zone-editor` spec 130 block; new check `apply-zones` (scratch directory in the OS temp folder).
- T7: docs/architecture.md. Found on the way: dynamic `bounds` are design cells; the editor drew them unscaled and
  called them map pixels — both fixed.
