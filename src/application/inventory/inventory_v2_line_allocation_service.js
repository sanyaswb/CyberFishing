/**
 * Preserves the legacy line-length rules while inventory-v2 owns custody.
 *
 * A line is still a real flat item. When the selected reel/rod accepts only a
 * part of a spool, this service creates a unique equipped segment and leaves
 * the remainder as a free inventory item. It does not know about DOM or UI.
 */
class InventoryV2LineAllocationService {
  #repository;
  #itemReader;
  #policy;
  #instanceIdFactory;
  #isReserved;
  #sequence = 0;

  constructor({
    repository,
    itemReader,
    linePolicy = null,
    lineConfig = {},
    instanceIdFactory = null,
    isReserved = null,
  } = {}) {
    if (!repository?.require || !repository?.update || !repository?.add) {
      throw new TypeError(
        "InventoryV2LineAllocationService requires FlatInventoryItemRepository",
      );
    }
    this.#repository = repository;
    this.#itemReader = itemReader;
    this.#policy =
      linePolicy ||
      (typeof LineAllocationPolicy !== "undefined"
        ? new LineAllocationPolicy(lineConfig)
        : null);
    if (!this.#policy?.resolve) {
      throw new TypeError(
        "InventoryV2LineAllocationService requires LineAllocationPolicy",
      );
    }
    this.#instanceIdFactory = instanceIdFactory;
    this.#isReserved = typeof isReserved === "function" ? isReserved : () => false;
  }

  prepare({ sourceInstanceId, rod, reel = null } = {}) {
    return this.#prepareWithResolver(sourceInstanceId, (line) =>
      this.#policy.resolve({
        lineItem: line,
        equipment: { rod, reel },
      }),
    );
  }

  prepareForReel({ sourceInstanceId, reel } = {}) {
    if (typeof this.#policy.resolveForReel !== "function") {
      throw new TypeError("LineAllocationPolicy.resolveForReel() is required");
    }
    return this.#prepareWithResolver(sourceInstanceId, (line) =>
      this.#policy.resolveForReel({ lineItem: line, reel }),
    );
  }

  #prepareWithResolver(sourceInstanceId, resolveAllocation) {
    const checkpoint = this.#repository.createSnapshot();
    try {
      const source = this.#repository.require(sourceInstanceId);
      if (!InventoryItemLocation.isInventory(source.location)) {
        return this.#failure("Ліска зараз недоступна в інвентарі.");
      }
      if (this.#isReserved(source.instanceId)) {
        return this.#failure(
          "The selected line is already reserved by equipment.",
        );
      }
      const line = this.#hydrate(source);
      if (this.#type(line) !== "fishing_line") {
        return this.#failure("Обраний предмет не є ліскою.");
      }
      const allocation = resolveAllocation(line);
      if (!allocation?.isValid) {
        return this.#failure(allocation?.reason || "Ліска несумісна.", {
          allocation,
        });
      }

      const isolated = this.#repository.splitOne(sourceInstanceId);
      if (!allocation.shouldSplit) {
        return Object.freeze({
          success: true,
          instanceId: isolated.instanceId,
          allocation: Object.freeze({ ...allocation }),
          warning: allocation.reason || null,
        });
      }

      const remainingLength = Math.max(
        0,
        Number(allocation.remainingLengthMeters) || 0,
      );
      const equippedLength = Math.max(
        0,
        Number(allocation.equipLengthMeters) || 0,
      );
      this.#repository.update(isolated.instanceId, {
        statOverrides: {
          ...(isolated.statOverrides || {}),
          lengthMeters: remainingLength,
        },
        quantity: 1,
      });
      const segment = this.#repository.add({
        ...this.#clone(isolated),
        instanceId: this.#nextInstanceId(isolated),
        quantity: 1,
        statOverrides: {
          ...(isolated.statOverrides || {}),
          lengthMeters: equippedLength,
        },
        detachedLineSegment: true,
        sourceLineItemId: isolated.itemId,
        sourceLineInstanceId: isolated.instanceId,
        location: InventoryItemLocation.inventory(),
      });
      return Object.freeze({
        success: true,
        instanceId: segment.instanceId,
        remainderInstanceId: isolated.instanceId,
        allocation: Object.freeze({ ...allocation }),
        warning: allocation.reason || null,
      });
    } catch (error) {
      this.#repository.restoreSnapshot(checkpoint);
      throw error;
    }
  }

  /**
   * Validates a line segment that is already installed without allocating or
   * splitting it again. Prepared reels use this when the active rod changes.
   */
  validateExisting({ instanceId = null, line = null, rod, reel = null } = {}) {
    const raw = line || (instanceId ? this.#repository.get(instanceId) : null);
    if (!raw) {
      return this.#failure("Встановлену ліску не знайдено.");
    }
    const hydrated = this.#hydrate(raw);
    if (this.#type(hydrated) !== "fishing_line") {
      return this.#failure("Встановлений компонент не є ліскою.");
    }
    const allocation = this.#policy.resolve({
      lineItem: hydrated,
      equipment: { rod, reel },
    });
    if (!allocation?.isValid) {
      return this.#failure(allocation?.reason || "Ліска несумісна.", {
        allocation,
      });
    }
    if (allocation.shouldSplit) {
      return this.#failure(
        "Встановлена ліска перевищує місткість котушки.",
        { allocation },
      );
    }
    return Object.freeze({
      success: true,
      instanceId: raw.instanceId || instanceId,
      allocation: Object.freeze({ ...allocation }),
      warning: null,
    });
  }

  release(instanceId) {
    const item = this.#repository.get(instanceId);
    if (!item) return Object.freeze({ success: false, merged: false });
    if (this.#type(this.#hydrate(item)) !== "fishing_line") {
      return Object.freeze({ success: false, merged: false });
    }
    if (this.#isReserved(item.instanceId)) {
      return Object.freeze({
        success: false,
        merged: false,
        reserved: true,
        instanceId,
      });
    }
    if (!InventoryItemLocation.isInventory(item.location)) {
      this.#repository.setLocation(
        instanceId,
        InventoryItemLocation.inventory(),
      );
    }

    const released = this.#repository.require(instanceId);
    const preferred = released.sourceLineInstanceId
      ? this.#repository.get(released.sourceLineInstanceId)
      : null;
    const target = this.#canMergeInto(released, preferred)
      ? preferred
      : this.#repository.list().find(
          (candidate) => this.#canMergeInto(released, candidate),
        ) || null;
    if (!target) {
      this.#repository.update(instanceId, (current) => {
        const normalized = { ...current, quantity: 1 };
        delete normalized.detachedLineSegment;
        delete normalized.sourceLineItemId;
        delete normalized.sourceLineInstanceId;
        return normalized;
      });
      return Object.freeze({
        success: true,
        merged: false,
        instanceId,
      });
    }

    const totalLength = this.getLengthMeters(target) + this.getLengthMeters(released);
    this.#repository.update(target.instanceId, {
      statOverrides: {
        ...(target.statOverrides || {}),
        lengthMeters: totalLength,
      },
      quantity: 1,
    });
    this.#repository.remove(instanceId);
    return Object.freeze({
      success: true,
      merged: true,
      instanceId: target.instanceId,
      lengthMeters: totalLength,
    });
  }

  break(instanceId, lossMeters) {
    const item = this.#repository.get(instanceId);
    if (!item || this.#type(this.#hydrate(item)) !== "fishing_line") {
      return Object.freeze({ success: false, depleted: false });
    }
    const loss = Math.max(0, Number(lossMeters) || 0);
    const remaining = Math.max(0, this.getLengthMeters(item) - loss);
    if (remaining <= 0.001) {
      if (this.#repository.getChildren(instanceId).length > 0) {
        throw new Error("Ліску з вкладеними компонентами неможливо видалити.");
      }
      this.#repository.remove(instanceId);
      return Object.freeze({
        success: true,
        depleted: true,
        remainingLengthMeters: 0,
      });
    }
    this.#repository.update(instanceId, {
      statOverrides: {
        ...(item.statOverrides || {}),
        lengthMeters: remaining,
      },
      quantity: 1,
    });
    return Object.freeze({
      success: true,
      depleted: false,
      remainingLengthMeters: remaining,
    });
  }

  getLengthMeters(itemOrInstanceId) {
    const raw =
      typeof itemOrInstanceId === "string"
        ? this.#repository.get(itemOrInstanceId)
        : itemOrInstanceId;
    if (!raw) return 0;
    const ownLength = Number(raw.statOverrides?.lengthMeters);
    if (Number.isFinite(ownLength)) return Math.max(0, ownLength);
    const hydrated = this.#hydrate(raw);
    const baseLength = Number(
      hydrated?.effectiveStats?.lengthMeters,
    );
    return Number.isFinite(baseLength) ? Math.max(0, baseLength) : 0;
  }

  #canMergeInto(source, candidate) {
    if (!source || !candidate || source.instanceId === candidate.instanceId) {
      return false;
    }
    if (source.itemId !== candidate.itemId) return false;
    if (!InventoryItemLocation.isInventory(candidate.location)) return false;
    if (candidate.quantity !== 1) return false;
    if (candidate.detachedLineSegment) return false;
    if (this.#isReserved(candidate.instanceId)) return false;
    if (this.#repository.getChildren(candidate.instanceId).length > 0) return false;
    return this.#hasSameLineSignature(source, candidate);
  }

  #hasSameLineSignature(left, right) {
    const a = this.#hydrate(left);
    const b = this.#hydrate(right);
    if (!a || !b) return false;
    const metadataKeys = [
      "id",
      "itemType",
      "rolledStats",
    ];
    const statKeys = [
      "maxLoadKg",
      "diameterMm",
      "durability",
      "quality",
    ];
    for (const key of metadataKeys) {
      if (this.#stableSerialize(a[key]) !== this.#stableSerialize(b[key])) {
        return false;
      }
    }
    for (const key of statKeys) {
      const leftValue = a.effectiveStats?.[key];
      const rightValue = b.effectiveStats?.[key];
      if (this.#stableSerialize(leftValue) !== this.#stableSerialize(rightValue)) {
        return false;
      }
    }
    return this.#stableSerialize(a.rarity) === this.#stableSerialize(b.rarity);
  }

  #hydrate(raw) {
    if (typeof this.#itemReader === "function") {
      return this.#itemReader(raw) || null;
    }
    return (
      this.#itemReader?.hydrate?.(raw) ||
      this.#itemReader?.getById?.(raw.instanceId) ||
      this.#itemReader?.get?.(raw.instanceId) ||
      raw
    );
  }

  #type(item) {
    return item?.itemType ?? null;
  }

  #nextInstanceId(source) {
    let candidate = null;
    do {
      this.#sequence += 1;
      if (typeof this.#instanceIdFactory === "function") {
        candidate = this.#instanceIdFactory("line_segment", source);
      } else if (this.#instanceIdFactory?.create) {
        candidate = this.#instanceIdFactory.create("line_segment", source);
      } else {
        candidate = `${source.instanceId}~segment-${this.#sequence}`;
      }
    } while (!candidate || this.#repository.has(String(candidate)));
    return String(candidate);
  }

  #failure(warning, details = {}) {
    return Object.freeze({
      success: false,
      instanceId: null,
      warning,
      ...details,
    });
  }

  #stableSerialize(value) {
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.#stableSerialize(entry)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      return `{${Object.keys(value)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.#stableSerialize(value[key])}`,
        )
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

globalThis.InventoryV2LineAllocationService =
  InventoryV2LineAllocationService;
