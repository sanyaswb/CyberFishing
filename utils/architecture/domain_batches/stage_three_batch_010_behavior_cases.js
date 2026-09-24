"use strict";

const assert = require("node:assert/strict");
const BATCH_010_EXECUTABLE_CASES = Object.freeze({
  UnlimitedAssemblyCapacityPolicy: Object.freeze({
    "exact-result-shape-and-values": Policy => {
      const result = new Policy().canApply();
      assert.deepEqual(Object.keys(result), ["allowed", "reason"]);
      assert.equal(result.allowed, true);
      assert.equal(result.reason, null);
      return result;
    },
    "fresh-result-per-call": Policy => {
      const policy = new Policy(), first = policy.canApply(), second = policy.canApply();
      assert.notStrictEqual(first, second);
      first.allowed = false;
      assert.equal(second.allowed, true);
      return [first, second];
    },
    "stateless-across-instances": Policy => {
      const first = new Policy(), second = new Policy();
      first.canApply().reason = "changed";
      const result = second.canApply();
      assert.deepEqual(Object.keys(result), ["allowed", "reason"]);
      assert.equal(result.reason, null);
      return result;
    },
    "consumer-context-does-not-change-result": Policy => {
      const policy = new Policy();
      return policy.canApply({ operation: "START_ASSEMBLY", incomingItems: [{ instanceId: "item-1" }] });
    },
  }),
});

module.exports = { BATCH_010_EXECUTABLE_CASES };
