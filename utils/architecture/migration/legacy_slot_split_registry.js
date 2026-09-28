"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PATH = "architecture/migration/legacy_slot_splits.json";
const KIND = "cyber-fishing-legacy-slot-splits";

// Reviewed splits of historical logical legacy slots into ordered physical members. index.html marks
// every member with data-legacy-slot="N"; the document may split a slot only as recorded here, with
// exactly these members in this physical order. Without the registry (every historical tree) no slot
// is split and the one-script-per-slot interpretation applies.
class LegacySlotSplitRegistry {
  constructor(document = null) {
    this.splits = document === null ? [] : LegacySlotSplitRegistry.validate(document).splits;
  }

  static load(projectRoot) {
    const file = path.join(projectRoot, PATH);
    return new LegacySlotSplitRegistry(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);
  }

  static validate(document) {
    const fail = message => { throw new Error(`Legacy slot split registry: ${message}`); };
    if (document?.schemaVersion !== 1 || document.kind !== KIND || !Array.isArray(document.splits)) fail("invalid document");
    const slots = new Set();
    const members = new Set();
    for (const split of document.splits) {
      if (!Number.isInteger(split?.slot) || split.slot < 1) fail("slot must be a positive integer");
      if (slots.has(split.slot)) fail(`slot ${split.slot} is split twice`);
      slots.add(split.slot);
      if (!Array.isArray(split.members) || split.members.length < 2) fail(`slot ${split.slot} needs at least two members`);
      for (const member of split.members) {
        if (typeof member !== "string" || !/^src\/.+\.js$/u.test(member)) fail(`invalid member ${member}`);
        if (members.has(member)) fail(`duplicated member ${member}`);
        members.add(member);
      }
      if (typeof split.transition !== "string" || !split.transition) fail(`slot ${split.slot} names no transition`);
    }
    return document;
  }

  // Asserts that the logical scripts read from index.html split exactly the reviewed slots, with the
  // reviewed members in their physical order, and that every other script keeps one slot.
  assertMatches(scripts) {
    const observed = new Map();
    for (const script of scripts) {
      if (!script.slotMember) continue;
      const members = observed.get(script.slotMember.slot) || [];
      if (script.slotMember.index !== members.length || script.legacyLoadOrder !== script.slotMember.slot) {
        throw new Error(`Legacy slot ${script.slotMember.slot} member order is broken at ${script.currentPath}`);
      }
      members.push(script.currentPath);
      observed.set(script.slotMember.slot, members);
    }
    const reviewed = new Map(this.splits.map(split => [split.slot, split.members]));
    for (const [slot, members] of observed) {
      const expected = reviewed.get(slot);
      if (!expected) throw new Error(`Legacy slot ${slot} is split without a reviewed record: ${members.join(", ")}`);
      if (JSON.stringify(members) !== JSON.stringify(expected)) {
        throw new Error(`Legacy slot ${slot} members differ from the reviewed split: ${members.join(", ")} ` +
          `(reviewed ${expected.join(", ")})`);
      }
    }
    for (const [slot, members] of reviewed) {
      if (!observed.has(slot)) throw new Error(`Reviewed split of legacy slot ${slot} is missing: ${members.join(", ")}`);
    }
    const paths = scripts.map(script => script.currentPath);
    const duplicate = paths.find((item, index) => paths.indexOf(item) !== index);
    if (duplicate) throw new Error(`Duplicated physical script: ${duplicate}`);
    return { splitSlots: reviewed.size, members: [...reviewed.values()].flat().length };
  }
}

module.exports = { LegacySlotSplitRegistry, PATH, KIND };
