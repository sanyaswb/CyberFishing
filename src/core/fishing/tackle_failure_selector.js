class TackleFailureSelector {
  static DEFAULT_TIE_BREAK_PRIORITY = Object.freeze(["leader", "line", "rod"]);
  static RESULT_BY_COMPONENT = Object.freeze({
    leader: "leader_lost",
    line: "line_break",
    rod: "rod_broken",
  });

  select({
    leaderMaxLoadKg = Infinity,
    lineMaxLoadKg = 0,
    rodMaxLoadKg = 0,
    tieBreakPriority = TackleFailureSelector.DEFAULT_TIE_BREAK_PRIORITY,
  } = {}) {
    const priority = this.#buildPriorityMap(tieBreakPriority);
    const candidates = [
      { component: "leader", maxLoadKg: this.#positiveFinite(leaderMaxLoadKg) },
      { component: "line", maxLoadKg: this.#positiveFinite(lineMaxLoadKg) },
      { component: "rod", maxLoadKg: this.#positiveFinite(rodMaxLoadKg) },
    ]
      .filter((candidate) => candidate.maxLoadKg > 0)
      .sort((a, b) => {
        if (a.maxLoadKg !== b.maxLoadKg) {
          return a.maxLoadKg - b.maxLoadKg;
        }
        return this.#priorityOf(priority, a.component) -
          this.#priorityOf(priority, b.component);
      });

    const selected = candidates[0] || {
      component: "line",
      maxLoadKg: 0,
    };
    return {
      component: selected.component,
      reason: selected.component,
      result: TackleFailureSelector.RESULT_BY_COMPONENT[selected.component] ||
        "line_break",
      maxLoadKg: selected.maxLoadKg,
      candidates,
      tieBreakPriority: this.#normalizePriority(tieBreakPriority),
    };
  }

  #buildPriorityMap(priorityList) {
    const map = new Map();
    this.#normalizePriority(priorityList).forEach((component, index) => {
      map.set(component, index);
    });
    return map;
  }

  #normalizePriority(priorityList) {
    const allowed = new Set(TackleFailureSelector.DEFAULT_TIE_BREAK_PRIORITY);
    const ordered = Array.isArray(priorityList)
      ? priorityList.filter((component) => allowed.has(component))
      : [];
    for (const component of TackleFailureSelector.DEFAULT_TIE_BREAK_PRIORITY) {
      if (!ordered.includes(component)) ordered.push(component);
    }
    return ordered;
  }

  #priorityOf(priorityMap, component) {
    return priorityMap.has(component) ? priorityMap.get(component) : 999;
  }

  #positiveFinite(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
}
