const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(
    path.join(
      root,
      "src/infrastructure/storage/inventory_v2_transaction_coordinator.js",
    ),
    "utf8",
  ),
  context,
  { filename: "inventory_v2_transaction_coordinator.js" },
);

vm.runInContext(`(() => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  const createFixture = ({ afterCommit = null } = {}) => {
    const state = { value: 0 };
    const counters = { snapshots: 0, restores: 0, saves: 0 };
    let persistedValue = state.value;
    const participant = {
      snapshot() {
        counters.snapshots += 1;
        return state.value;
      },
      restore(snapshot) {
        counters.restores += 1;
        state.value = snapshot;
      },
    };
    const coordinator = new InventoryV2TransactionCoordinator({
      participants: [participant],
      afterCommit: () => {
        if (afterCommit) afterCommit({ state, counters });
        counters.saves += 1;
        persistedValue = state.value;
      },
    });
    return {
      state,
      counters,
      coordinator,
      persistedValue: () => persistedValue,
    };
  };

  {
    const fixture = createFixture();
    fixture.coordinator.runAtomic(() => {
      fixture.state.value = 1;
      fixture.coordinator.runAtomic(() => {
        fixture.state.value = 2;
      });
      fixture.state.value = 3;
    });
    assert(fixture.counters.snapshots === 1,
      "nested success must take only the outer snapshot");
    assert(fixture.counters.saves === 1,
      "nested success must persist exactly once");
    assert(fixture.persistedValue() === 3,
      "only the final outer state may be persisted");
  }

  {
    const fixture = createFixture();
    const nestedError = new Error("caught nested failure");
    let receivedError = null;
    try {
      fixture.coordinator.runAtomic(() => {
        fixture.state.value = 10;
        try {
          fixture.coordinator.runAtomic(() => {
            fixture.state.value = 20;
            throw nestedError;
          });
        } catch (error) {
          assert(error === nestedError,
            "the nested caller must receive the original error");
        }
        fixture.state.value = 30;
      });
    } catch (error) {
      receivedError = error;
    }
    assert(receivedError === nestedError,
      "a caught nested failure must keep the outer unit of work rollback-only");
    assert(fixture.state.value === 0,
      "rollback-only outer work must restore its initial RAM state");
    assert(fixture.counters.saves === 0,
      "rollback-only outer work must not persist");
  }

  {
    const fixture = createFixture();
    const nestedError = new Error("uncaught nested failure");
    let receivedError = null;
    try {
      fixture.coordinator.runAtomic(() => {
        fixture.state.value = 10;
        fixture.coordinator.runAtomic(() => {
          fixture.state.value = 20;
          throw nestedError;
        });
      });
    } catch (error) {
      receivedError = error;
    }
    assert(receivedError === nestedError,
      "an uncaught nested failure must preserve the original error");
    assert(fixture.state.value === 0,
      "an uncaught nested failure must restore the outer checkpoint");
    assert(fixture.counters.restores === 1,
      "an uncaught nested failure must restore only once");
  }

  {
    const fixture = createFixture();
    const outerError = new Error("failure after nested mutation");
    let receivedError = null;
    try {
      fixture.coordinator.runAtomic(() => {
        fixture.state.value = 10;
        fixture.coordinator.runAtomic(() => {
          fixture.state.value = 20;
        });
        throw outerError;
      });
    } catch (error) {
      receivedError = error;
    }
    assert(receivedError === outerError,
      "failure after nested mutation must preserve the outer error");
    assert(fixture.state.value === 0,
      "failure after nested mutation must roll RAM back");
    assert(fixture.persistedValue() === 0 && fixture.counters.saves === 0,
      "failure after nested mutation must not leave an intermediate persisted snapshot");

    fixture.coordinator.runAtomic(() => {
      fixture.state.value = 40;
    });
    assert(fixture.state.value === 40 && fixture.persistedValue() === 40,
      "the coordinator must be reusable after rollback");
    assert(fixture.counters.saves === 1,
      "the reusable coordinator must commit exactly once");
  }

  {
    let failCommit = true;
    const commitError = new Error("persistence failed");
    const fixture = createFixture({
      afterCommit: () => {
        if (failCommit) throw commitError;
      },
    });
    let receivedError = null;
    try {
      fixture.coordinator.runAtomic(() => {
        fixture.state.value = 50;
      });
    } catch (error) {
      receivedError = error;
    }
    assert(receivedError === commitError,
      "afterCommit failure must be propagated");
    assert(fixture.state.value === 0,
      "afterCommit failure must restore RAM");

    failCommit = false;
    fixture.coordinator.runAtomic(() => {
      fixture.state.value = 60;
    });
    assert(fixture.persistedValue() === 60,
      "coordinator state must be cleared after afterCommit failure");
  }

  {
    const state = { first: 0, second: 0 };
    let failRestore = true;
    let firstRestoreAttempts = 0;
    const restoreOrder = [];
    const restoreError = new Error("restore failed");
    const primaryError = new Error("operation failed");
    const coordinator = new InventoryV2TransactionCoordinator({
      participants: [
        {
          snapshot: () => state.first,
          restore: (snapshot) => {
            firstRestoreAttempts += 1;
            restoreOrder.push("first");
            state.first = snapshot;
          },
        },
        {
          snapshot: () => state.second,
          restore: (snapshot) => {
            restoreOrder.push("second");
            if (failRestore) throw restoreError;
            state.second = snapshot;
          },
        },
      ],
    });
    let receivedError = null;
    try {
      coordinator.runAtomic(() => {
        state.first = 1;
        state.second = 1;
        throw primaryError;
      });
    } catch (error) {
      receivedError = error;
    }
    assert(receivedError === primaryError,
      "restore failure must not replace the primary transaction error");
    assert(receivedError.rollbackError === restoreError,
      "restore failure should remain available for diagnostics");
    assert(firstRestoreAttempts === 1 && state.first === 0,
      "all reverse restores must be attempted after one restore fails");
    assert(restoreOrder.join(",") === "second,first",
      "participants must be restored in reverse checkpoint order");

    failRestore = false;
    coordinator.runAtomic(() => {
      state.first = 2;
      state.second = 2;
    });
    assert(state.first === 2 && state.second === 2,
      "coordinator state must be reusable after restore failure");
  }
})()`, context);

console.log("Inventory-v2 transaction check passed.");
