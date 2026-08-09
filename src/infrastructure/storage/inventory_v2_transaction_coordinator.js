/**
 * Coordinates an in-memory transaction across the small inventory aggregates.
 * Every participant supplies snapshot/restore functions. Nested operations
 * share the outer checkpoint and persistence boundary. Any nested failure
 * marks the whole unit of work rollback-only, even when a caller catches it.
 */
class InventoryV2TransactionCoordinator {
  #participants;
  #afterCommit;
  #depth = 0;
  #outerCheckpoints = null;
  #rollbackOnly = false;
  #rollbackReason = null;

  constructor({ participants = [], afterCommit = null } = {}) {
    this.#participants = participants.map((participant) =>
      this.#normalizeParticipant(participant),
    );
    this.#afterCommit = typeof afterCommit === "function" ? afterCommit : null;
  }

  runAtomic(operation) {
    if (typeof operation !== "function") {
      throw new TypeError("Inventory transaction requires an operation");
    }
    const isOutermost = this.#depth === 0;
    if (isOutermost) this.#beginOuterTransaction();
    this.#depth += 1;

    let result;
    let operationFailed = false;
    let operationError = null;
    try {
      result = operation();
    } catch (error) {
      operationFailed = true;
      operationError = error;
      this.#markRollbackOnly(error);
    } finally {
      this.#depth -= 1;
    }

    if (!isOutermost) {
      if (operationFailed) throw operationError;
      return result;
    }

    try {
      if (this.#rollbackOnly) {
        const primaryError = this.#rollbackReason;
        const restoreError = this.#restoreOuterCheckpoints();
        this.#attachRollbackError(primaryError, restoreError);
        throw primaryError;
      }

      try {
        this.#afterCommit?.();
      } catch (error) {
        const restoreError = this.#restoreOuterCheckpoints();
        this.#attachRollbackError(error, restoreError);
        throw error;
      }
      return result;
    } finally {
      this.#clearOuterTransaction();
    }
  }

  #beginOuterTransaction() {
    const checkpoints = this.#participants.map((participant) => ({
      participant,
      snapshot: participant.snapshot(),
    }));
    this.#outerCheckpoints = checkpoints;
    this.#rollbackOnly = false;
    this.#rollbackReason = null;
  }

  #markRollbackOnly(error) {
    if (this.#rollbackOnly) return;
    this.#rollbackOnly = true;
    this.#rollbackReason = error;
  }

  #restoreOuterCheckpoints() {
    let firstRestoreError = null;
    const checkpoints = this.#outerCheckpoints || [];
    for (let index = checkpoints.length - 1; index >= 0; index -= 1) {
      const checkpoint = checkpoints[index];
      try {
        checkpoint.participant.restore(checkpoint.snapshot);
      } catch (error) {
        if (firstRestoreError === null) firstRestoreError = error;
      }
    }
    return firstRestoreError;
  }

  #attachRollbackError(primaryError, restoreError) {
    if (!restoreError || !primaryError || typeof primaryError !== "object") {
      return;
    }
    try {
      if (!("rollbackError" in primaryError)) {
        Object.defineProperty(primaryError, "rollbackError", {
          configurable: true,
          value: restoreError,
        });
      }
    } catch (_error) {
      // Preserve the primary transaction failure even for frozen error values.
    }
  }

  #clearOuterTransaction() {
    this.#depth = 0;
    this.#outerCheckpoints = null;
    this.#rollbackOnly = false;
    this.#rollbackReason = null;
  }

  #normalizeParticipant(participant) {
    if (!participant) {
      throw new TypeError("Inventory transaction participant is required");
    }
    const snapshot =
      participant.snapshot ||
      participant.createSnapshot ||
      participant.toSnapshot;
    const restore = participant.restore || participant.restoreSnapshot;
    if (typeof snapshot !== "function" || typeof restore !== "function") {
      throw new TypeError(
        "Inventory transaction participant requires snapshot and restore",
      );
    }
    return {
      snapshot: () => snapshot.call(participant),
      restore: (value) => restore.call(participant, value),
    };
  }
}

globalThis.InventoryV2TransactionCoordinator =
  InventoryV2TransactionCoordinator;
