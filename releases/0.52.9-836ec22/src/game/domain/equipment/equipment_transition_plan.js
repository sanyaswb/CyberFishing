export class EquipmentTransitionPlan {
  constructor({
    kind,
    allowed,
    before,
    after,
    movements = [],
    capacity = null,
    warning = null,
  } = {}) {
    this.kind = kind || "equipment-transition";
    this.allowed = allowed === true;
    this.before = Object.freeze({ ...(before || {}) });
    this.after = Object.freeze({ ...(after || before || {}) });
    this.movements = Object.freeze(
      movements.map((movement) => Object.freeze({ ...movement })),
    );
    this.capacity = capacity ? Object.freeze({ ...capacity }) : null;
    this.warning = warning || null;
    Object.freeze(this);
  }

  get isNoop() {
    return this.movements.length === 0;
  }
}
