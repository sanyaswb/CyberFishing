"use strict";

const attempt = action => {
  try {
    return { value: action() };
  } catch (error) {
    return { error: { name: error.name, message: error.message } };
  }
};

// Minimal in-memory read-model collaborators. Attached locations use the ATTACHED kind the
// completed InventoryItemLocation export recognizes; both variants read the same export.
const attached = (parentInstanceId, slotId, slotIndex = 0) =>
  ({ kind: "ATTACHED", parentInstanceId, slotId, slotIndex });
const fixture = ({ cyclic = false } = {}) => {
  const items = new Map([
    ["rod", { instanceId: "rod", itemId: "rod_a", location: { kind: "INVENTORY" } }],
    ["reel", { instanceId: "reel", itemId: "reel_a", location: attached("rod", "reel") }],
    ["line", { instanceId: "line", itemId: "line_a", location: attached("reel", "line") }],
    ["hook1", { instanceId: "hook1", itemId: "hook_a", location: attached("line", "hook", 1) }],
  ]);
  if (cyclic) {
    items.get("rod").location = attached("hook1", "loop");
  }
  const repository = {
    get: id => items.get(id) || null,
    require: id => {
      if (!items.has(id)) throw new RangeError(`Unknown item ${id}`);
      return items.get(id);
    },
    getChild: (parent, slotId, slotIndex = 0) => [...items.values()].find(item =>
      item.location.kind === "ATTACHED" && item.location.parentInstanceId === parent &&
      item.location.slotId === slotId && item.location.slotIndex === slotIndex) || null,
    getChildren: (parent, slotId = null) => [...items.values()].filter(item =>
      item.location.kind === "ATTACHED" && item.location.parentInstanceId === parent &&
      (slotId === null || item.location.slotId === slotId)),
    listDescendants: root => [...items.values()].filter(item => item.instanceId !== root)
      .map(item => ({ item })),
  };
  const states = new Map([["rod", {
    profileId: "spinning",
    toSnapshot: () => ({ rootInstanceId: "rod", profileId: "spinning", status: "PREPARED" }),
    getRefillSignature: path => (path === "reel.line.hook[1]" ? { key: "hook_a" } : null),
  }]]);
  const stateRepository = {
    get: id => states.get(id) || null,
    require: id => {
      if (!states.has(id)) throw new RangeError(`Unknown state ${id}`);
      return states.get(id);
    },
  };
  const slots = { reel: { id: "reel", capacity: 1 }, line: { id: "line", capacity: 1 },
    hook: { id: "hook", capacity: 3, capacityProperty: "hookCount" } };
  const profileRegistry = {
    resolveSlot: (parent, slotId, profileId) => (slots[slotId] ? { ...slots[slotId], profileId } : null),
    getSlotCapacity: (parent, definition) => definition.capacity + parent.itemId.length,
  };
  return { repository, stateRepository, profileRegistry };
};

const BATCH_022_EXECUTABLE_CASES = Object.freeze({
  ItemAssemblyPath: Object.freeze({
    "parse-segments-indices-and-errors": Path => ({
      parsed: [Path.parse("reel"), Path.parse("reel.line.hook[2]"), Path.parse("a_b-c[10].d")],
      errors: ["", "   ", 7, null, "reel..line", "1reel", "reel[x]", "reel[-1]"]
        .map(value => attempt(() => Path.parse(value))),
    }),
  }),
  ItemAssemblyReader: Object.freeze({
    "constructor-requirements": Reader => {
      const full = fixture();
      return [{}, { repository: full.repository }, { repository: full.repository,
        stateRepository: full.stateRepository }, undefined]
        .map(options => attempt(() => new Reader(options)));
    },
    "paths-slots-roots-and-state": Reader => {
      const reader = new Reader(fixture());
      return {
        child: reader.getChild("rod", "reel"),
        children: reader.getChildren("line").map(item => item.instanceId),
        slot: reader.readSlot("line", "hook", 1),
        capacity: [reader.getSlotCapacity("rod", "reel"), reader.getSlotCapacity("line", "missing")],
        path: reader.readPath("rod", "reel.line.hook[1]"),
        missingPath: reader.readPath("rod", "reel.line.hook[2]"),
        roots: ["rod", "reel", "hook1"].map(id => reader.getRootInstanceId(id)),
        slotPaths: [reader.getPathToSlot("rod", "rod", "reel"), reader.getPathToSlot("rod", "line", "hook", 2)],
        itemPaths: ["rod", "reel", "hook1"].map(id => reader.getPathToItem("rod", id)),
        state: reader.getAssemblyState("rod"),
        missingState: reader.getAssemblyState("reel"),
        signatures: [reader.getRefillSignature("rod", "reel.line.hook[1]"), reader.getRefillSignature("x", "y")],
        descendants: reader.listDescendants("rod").map(item => item.instanceId),
        errors: [
          attempt(() => reader.getPathToSlot("rod", "line", "unknown")),
          attempt(() => reader.getPathToItem("reel", "hook1")),
          attempt(() => reader.readPath("missing", "reel")),
        ],
      };
    },
    "attachment-cycle-detection": Reader => {
      const reader = new Reader(fixture({ cyclic: true }));
      return [attempt(() => reader.getRootInstanceId("reel")), attempt(() => reader.getRootInstanceId("hook1"))];
    },
  }),
});

module.exports = { BATCH_022_EXECUTABLE_CASES };
