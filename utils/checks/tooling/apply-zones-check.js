"use strict";
// Spec 130 D6: `npm run apply:zones` moves an exported zone file into the location's data module only when it is
// safe — a valid file, a clean target, no conflict (or --force) and a confirmation — and keeps a backup. Every case
// runs on a module in a scratch directory; the real src/ module is only read, to prove the round trip.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { ZoneFileApplier, sha256 } = require("../../apply-zones.js");

const root = path.resolve(__dirname, "../../..");
const load = file => import(pathToFileURL(path.join(root, file)).href);

(async () => {
  const format = await load("src/dev/location/zone_export_format.js");
  const { ZONES } = await load("src/game/config/raw/locations/zones/test.js");
  const { MAP_DB } = await load("src/game/config/databases/location_catalog.js");
  assert.equal(MAP_DB.test.zones, ZONES, "the location catalog joins the zone data module");
  const real = fs.readFileSync(path.join(root, "src/game/config/raw/locations/zones/test.js"), "utf8");
  assert.equal(format.zoneModuleSource("test", ZONES), real, "the committed module is in the script's canonical form");

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-apply-zones-"));
  try {
    const locations = { designCellSize: 40, cellSize: 40, baseResolution: { width: 2560, height: 1440 }, map: { test: {}, pond: {} } };
    const target = path.join(scratch, "test.js");
    const backups = path.join(scratch, "backups");
    let dirty = false, answer = true, asked = 0, checks = 0, reads = 0;
    const logs = [];
    const applier = new ZoneFileApplier({ format, locations, modulePath: id => path.join(scratch, `${id}.js`),
      readZones: async file => { reads++; return (await import(`${pathToFileURL(file).href}?read=${reads}`)).ZONES; },
      isDirty: () => dirty, confirm: async () => { asked++; return answer; }, backupDir: backups,
      runChecks: () => { checks++; }, log: message => logs.push(message), now: () => new Date("2026-10-22T18:40:05Z") });
    const reset = () => fs.writeFileSync(target, real);
    const baseHash = await format.zoneHash(ZONES, sha256);
    const exported = (zones, extra = {}) => JSON.stringify({ ...format.buildZoneFile({ locationId: "test", zones, baseHash,
      gameVersion: "0.46.21", locations, exportedAt: "2026-10-22T18:40:00.000Z" }), ...extra });
    const moved = JSON.parse(JSON.stringify(ZONES));
    const movedFrom = ZONES.collisions[0].x, movedTo = movedFrom + 2;
    moved.collisions[0].x = movedTo;
    moved.snags.push({ x: 1, y: 2, w: 3, h: 1 });
    moved.dynamic[0].shape = "circle";
    moved.castable[0].mask = { enabled: true, cell: [.5, .5], rects: [[0, 0, 2, 1], [0, 1, 1, 1]] };

    // Hash: key order never matters, and the browser and the script hash the same text.
    const shuffled = { dynamic: ZONES.dynamic.map(zone => Object.fromEntries(Object.entries(zone).reverse())), snags: ZONES.snags,
      collisions: ZONES.collisions, castable: ZONES.castable };
    assert.equal(await format.zoneHash(shuffled, sha256), baseHash, "the same zones in another key order give the same hash");
    // TK-077: binary-fraction noise never reaches a file; exact fractions stay.
    const noisy = format.canonicalZones({ castable: [{ x: 0.1 + 0.2, y: 11.700000000000001, w: 0.00703125, h: 17.12571864024948 }] }).castable[0];
    assert.deepEqual([noisy.x, noisy.y, noisy.w, noisy.h], [0.3, 11.7, 0.00703125, 17.12571864024948],
      "11.700000000000001 is written as 11.7; exact and genuinely long values stay");
    const shuffledMasks = JSON.parse(JSON.stringify(moved));
    shuffledMasks.castable[0].mask = { rects: [[0, 1, 1, 1], [0, 0, 2, 1]], cell: [.5, .5], enabled: true };
    assert.equal(await format.zoneHash(shuffledMasks, sha256), await format.zoneHash(moved, sha256), 'mask key/rectangle order does not change hashes');

    reset();
    assert.equal(await applier.apply(exported(moved)), "applied");
    assert.equal(asked, 1, "the owner confirms the write");
    const written = (await import(`${pathToFileURL(target).href}?after=1`)).ZONES;
    assert.deepEqual(format.canonicalZones(written), format.canonicalZones(moved), "the module now holds the file's zones");
    assert(!logs.some(line => line.includes("undefined")), "a missing field reads немає, not undefined");
    assert(logs.some(line => line.includes(`collisions 1: x ${movedFrom} -> ${movedTo}`)) && logs.some(line => line.includes("snags 2: додано")),
      "the change is shown per zone before the question");
    const [backup] = fs.readdirSync(backups);
    // TK-078: the local time of the moment, whatever the machine's zone (18:40:05 UTC is 21:40:05 in Kyiv).
    const moment = new Date("2026-10-22T18:40:05Z"), pad = value => String(value).padStart(2, "0");
    assert.equal(backup, `${moment.getFullYear()}${pad(moment.getMonth() + 1)}${pad(moment.getDate())}-${pad(moment.getHours())}${pad(moment.getMinutes())}${pad(moment.getSeconds())}-test.js`,
      "the backup is named in local time");
    assert.equal(fs.readFileSync(path.join(backups, backup), "utf8"), real, "the replaced module is backed up byte for byte");
    assert.equal(checks, 1, "the config and game-cycle checks run after the write");

    // Re-applying the same export is now a conflict (the code changed since its baseHash); with --force it is unchanged.
    assert.equal(await applier.apply(exported(moved)), "refused", "a newer code state stops the import");
    assert(logs.some(line => line.startsWith("Конфлікт")), "the conflict is explained");
    assert.equal(await applier.apply(exported(moved), { force: true }), "unchanged", "nothing to do once the code matches");

    // Refusals write nothing.
    reset();
    const untouched = () => assert.equal(fs.readFileSync(target, "utf8"), real);
    asked = 0;
    for (const [text, reason] of [["{", "not JSON"], [exported(moved, { locationId: "lake" }), "unknown location"],
      [exported(moved, { designCellSize: 20 }), "another design grid"], [exported({ ...moved, castable: [{ x: 0, y: 0, w: 0, h: 1 }] }), "an empty zone"],
      [exported({ ...moved, dynamic: [{ ...moved.dynamic[0] }, { ...moved.dynamic[0] }] }), "a repeated dynamic id"],
      [exported({ ...moved, dynamic: [{ ...moved.dynamic[0], shape: "triangle" }] }), "an unknown shape"],
      [exported({ ...moved, dynamic: [{ ...moved.dynamic[0], h: 2 }] }), "an unequal circle"]]) {
      assert.equal(await applier.apply(text, { yes: true }), "refused", reason); untouched();
    }
    assert.equal(await applier.apply(exported(moved, { locationId: "pond" }), { yes: true }), "refused", "a location without a module");
    for (const badMask of [
      { enabled: true, cell: [.5, .5], rects: [[0, 0, 1, 1], [1, 1, 1, 1]] },
      { enabled: true, cell: [.5, .5], rects: [] },
      { enabled: true, cell: [.5, .5], rects: [[0, 0, 3, 1]] },
      { enabled: true, cell: [0, .5], rects: [[0, 0, 1, 1]] },
    ]) {
      const file = JSON.parse(exported(moved)); file.zones.castable[0].mask = badMask;
      assert.equal(await applier.apply(JSON.stringify(file), { yes: true }), 'refused', 'invalid saved mask is rejected before write'); untouched();
    }
    dirty = true;
    assert.equal(await applier.apply(exported(moved), { yes: true }), "refused", "uncommitted changes in the target are kept");
    untouched(); dirty = false;
    answer = false;
    assert.equal(await applier.apply(exported(moved)), "cancelled", "answering no writes nothing"); untouched();
    assert.equal(asked, 1, "only a valid, clean, conflict-free change is asked about");
    assert.equal(await applier.apply(exported(ZONES), { yes: true }), "unchanged", "an export of the code's zones changes nothing");
    assert.equal(checks, 1, "checks run only after a write");
    console.log("apply:zones passed: canonical module, hash order independence, confirmed write with backup and checks, conflict and --force, refusals of invalid, unknown, dirty and cancelled imports.");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
