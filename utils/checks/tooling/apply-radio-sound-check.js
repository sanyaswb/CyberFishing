"use strict";
// TK-099: `npm run apply:radio` moves a radio sound settings file exported by DevTools into the data module only when
// it is safe — a valid file (the code's keys and value types), a clean target, no conflict (or --force) and a
// confirmation — and keeps a backup. Every case runs on a module in a scratch directory; the real module is only read.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { RadioSoundApplier, sha256 } = require("../../apply-radio-sound.js");

const root = path.resolve(__dirname, "../../..");
const load = file => import(pathToFileURL(path.join(root, file)).href);

(async () => {
  const format = await load("src/dev/radio/radio_sound_settings_format.js");
  const { RADIO_SOUND_SETTINGS } = await load(format.RADIO_SOUND_MODULE);
  const { CONFIG } = await load("src/game/config/runtime/game_config.js");
  assert.equal(CONFIG.radio.effects, RADIO_SOUND_SETTINGS.effects, "CONFIG.radio reads the effects from the data module");
  assert.equal(CONFIG.radio.signal, RADIO_SOUND_SETTINGS.signal, "and the signal's interference");
  const real = fs.readFileSync(path.join(root, format.RADIO_SOUND_MODULE), "utf8");
  assert.equal(format.settingsModuleSource(RADIO_SOUND_SETTINGS), real, "the committed module is in the script's canonical form");
  assert.deepEqual(format.pickSettings(CONFIG.radio), format.canonicalSettings(RADIO_SOUND_SETTINGS),
    "an export of the unchanged config equals the code");

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-apply-radio-"));
  try {
    const target = path.join(scratch, "radio_sound_settings.js");
    const backups = path.join(scratch, "backups");
    let dirty = false, answer = true, asked = 0, checks = 0, reads = 0;
    const logs = [];
    const applier = new RadioSoundApplier({ format, target,
      readSettings: async file => { reads++; return (await import(`${pathToFileURL(file).href}?read=${reads}`)).RADIO_SOUND_SETTINGS; },
      isDirty: () => dirty, confirm: async () => { asked++; return answer; }, backupDir: backups,
      runChecks: () => { checks++; }, log: message => logs.push(message), now: () => new Date("2026-10-25T18:40:05Z") });
    const reset = () => fs.writeFileSync(target, real);
    const baseHash = await format.settingsHash(RADIO_SOUND_SETTINGS, sha256);
    const exported = (settings, extra = {}) => JSON.stringify({ ...format.buildSettingsFile({ settings, baseHash,
      gameVersion: "0.48.4", exportedAt: "2026-10-25T18:40:00.000Z" }), ...extra });
    const tuned = JSON.parse(JSON.stringify(RADIO_SOUND_SETTINGS));
    tuned.effects.vinyl.enabled = true;
    tuned.effects.vinyl.crackleLevel = 0.2;
    tuned.signal.enabled = false;

    const shuffled = { signal: RADIO_SOUND_SETTINGS.signal, effects: RADIO_SOUND_SETTINGS.effects };
    assert.equal(await format.settingsHash(shuffled, sha256), baseHash, "key order never changes the hash");

    reset();
    assert.equal(await applier.apply(exported(tuned)), "applied");
    assert.equal(asked, 1, "the owner confirms the write");
    const written = (await import(`${pathToFileURL(target).href}?after=1`)).RADIO_SOUND_SETTINGS;
    assert.equal(written.effects.vinyl.enabled, true);
    assert.equal(written.effects.vinyl.crackleLevel, 0.2);
    assert.equal(written.signal.enabled, false, "the file's values are in the module");
    assert.equal(checks, 1, "the checks run after a write");
    assert.equal(fs.readdirSync(backups).length, 1, "the previous module is backed up");
    assert(logs.some(line => line.includes("effects.vinyl.crackleLevel: 0.12 -> 0.2")), "the change is shown");

    reset();
    assert.equal(await applier.apply(exported(RADIO_SOUND_SETTINGS)), "unchanged", "the same settings change nothing");
    answer = false;
    assert.equal(await applier.apply(exported(tuned)), "cancelled");
    assert.equal(fs.readFileSync(target, "utf8"), real, "a cancelled apply writes nothing");
    answer = true;

    const unknown = JSON.parse(JSON.stringify(tuned));
    unknown.effects.vinyl.secret = 1;
    assert.equal(await applier.apply(exported(unknown)), "refused", "an unknown setting is refused");
    const wrongType = JSON.parse(JSON.stringify(tuned));
    wrongType.signal.enabled = "no";
    assert.equal(await applier.apply(exported(wrongType)), "refused", "a wrong type is refused");
    assert.equal(await applier.apply("{ not json"), "refused");
    assert.equal(await applier.apply(exported(tuned, { format: "zones" })), "refused", "another file format is refused");

    dirty = true;
    assert.equal(await applier.apply(exported(tuned)), "refused", "a module with uncommitted changes is refused");
    dirty = false;

    const conflict = exported(tuned, { baseHash: "0".repeat(64) });
    assert.equal(await applier.apply(conflict), "refused", "a conflict stops without --force");
    assert.equal(fs.readFileSync(target, "utf8"), real);
    assert.equal(await applier.apply(conflict, { force: true }), "applied", "--force replaces the code's settings");
    reset();
    asked = 0;
    assert.equal(await applier.apply(exported(tuned), { yes: true }), "applied");
    assert.equal(asked, 0, "--yes skips the question");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  console.log("Apply radio sound passed: the data module feeds CONFIG.radio in canonical form, key-order-free hash, apply "
    + "with confirmation, backup and checks, unchanged, cancelled, unknown key, wrong type, bad JSON, wrong format, dirty "
    + "module, conflict and --force, --yes.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
