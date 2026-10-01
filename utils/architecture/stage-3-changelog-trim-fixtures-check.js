"use strict";

// Owner decision 2026-10-01 (batch 047): a release may drop the oldest changelog entries from one
// reviewed version on (RELEASE.changelogTrimFrom). These fixtures prove that the release delta accepts
// only the exact declared trim on top of the new entry, and that the trim edit stays reversible.
const assert = require("node:assert/strict");
const { StageThreePatchReleaseTransition } = require("./domain_batches/stage_three_patch_release_transition");

let cases = 0;
const rejects = (action, pattern, name) => { assert.throws(action, pattern, name); cases += 1; };
const accepts = (action, name) => { assert.doesNotThrow(action, name); cases += 1; };

const entry = (version, line) => `## v${version} - Title ${version}\n\n### Changed\n\n- ${line}\n`;
const header = "# CyberFishing changelog\n\n";
const before = header + [entry("1.0.3", "three"), entry("1.0.2", "two"), entry("1.0.1", "one"), entry("1.0.0", "zero")]
  .join("\n");
const added = `${header}${entry("1.0.4", "four")}\n${before.slice(header.length)}`;
const transition = trimFrom => new StageThreePatchReleaseTransition(".", { fromRelease: "1.0.3", toRelease: "1.0.4",
  title: "Title 1.0.4", ...(trimFrom ? { changelogTrimFrom: trimFrom } : {}) });
const delta = (trimFrom, after) => () => transition(trimFrom).validateDelta("CHANGELOG.md", Buffer.from(before),
  Buffer.from(after));
const trimmed = StageThreePatchReleaseTransition.trimmedChangelog(added, "1.0.1", "1.0.3");

accepts(delta(null, added), "new entry without a trim");
accepts(delta("1.0.1", trimmed), "declared trim from 1.0.1");
accepts(() => assert.equal(trimmed.endsWith(entry("1.0.2", "two")), true), "trim keeps entries through 1.0.2");
rejects(delta(null, trimmed), /Historical changelog changed/u, "undeclared trim");
rejects(delta("1.0.2", trimmed), /Historical changelog changed/u, "trim wider than declared");
rejects(delta("1.0.0", trimmed), /Historical changelog changed/u, "trim narrower than declared");
rejects(delta("1.0.1", trimmed.replace("- two", "- 2")), /Historical changelog changed/u, "kept entry edited");
rejects(delta("1.0.1", added), /Historical changelog changed/u, "declared trim not applied");
rejects(() => StageThreePatchReleaseTransition.trimmedChangelog(before, "1.0.3", "1.0.3"), /keep the source release entry/u,
  "trim of the source release");
rejects(() => StageThreePatchReleaseTransition.trimmedChangelog(before, "0.9.0", "1.0.3"), /not unique/u, "unknown trim version");
rejects(() => StageThreePatchReleaseTransition.trimmedChangelog(before, "v1.0.1", "1.0.3"), /invalid/u, "malformed trim version");

// The projection's trim edit replaces the dropped tail by the last kept line and reverses exactly.
const lastLine = trimmed.slice(trimmed.lastIndexOf("\n", trimmed.length - 2) + 1);
const tail = lastLine + added.slice(trimmed.length);
const projected = StageThreePatchReleaseTransition.replace(added, tail, lastLine, 1);
accepts(() => assert.equal(projected, trimmed), "trim edit result");
accepts(() => assert.equal(StageThreePatchReleaseTransition.replace(projected, lastLine, tail, 1), added),
  "trim edit reverses exactly");

console.log(`Stage 3 changelog trim fixtures passed (${cases} cases).`);
