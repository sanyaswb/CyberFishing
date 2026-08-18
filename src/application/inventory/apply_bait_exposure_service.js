class ApplyBaitExposureService {
  #repository;
  #hydrator;
  #freshnessResolver;
  #statePolicy;
  #decayPolicy;
  #lastExposureTokenByInstance = new Map();

  constructor({
    repository,
    hydrator,
    freshnessResolver,
    freshnessStatePolicy = new ItemFreshnessStatePolicy(),
    decayPolicy = new BaitFreshnessDecayPolicy(),
  } = {}) {
    if (!repository?.update || !repository?.list) {
      throw new TypeError("ApplyBaitExposureService requires repository");
    }
    if (!hydrator?.hydrate) {
      throw new TypeError("ApplyBaitExposureService requires hydrator");
    }
    if (!freshnessResolver?.resolve) {
      throw new TypeError("ApplyBaitExposureService requires freshnessResolver");
    }
    this.#repository = repository;
    this.#hydrator = hydrator;
    this.#freshnessResolver = freshnessResolver;
    this.#statePolicy = freshnessStatePolicy;
    this.#decayPolicy = decayPolicy;
  }

  apply({ instanceIds = [], exposureMs = 0, exposureToken = null } = {}) {
    const requested = new Set((instanceIds || []).filter(Boolean).map(String));
    const report = [];
    for (const instanceId of requested) {
      if (
        exposureToken &&
        this.#lastExposureTokenByInstance.get(instanceId) === exposureToken
      ) {
        continue;
      }
      const raw = this.#repository.get(instanceId);
      if (!raw) continue;
      const item = this.#hydrator.hydrate(raw, this.#repository);
      const descriptor = this.#freshnessResolver.resolve(item);
      if (!descriptor?.available) continue;
      const previous = this.#statePolicy.resolvePercent(raw.freshnessState);
      const current = this.#decayPolicy.resolve({
        percent: previous,
        exposureMs,
        lossPerMinute: descriptor.lossPerMinute,
      });
      const freshnessState = this.#statePolicy.create(current, {
        omitDefault: true,
      });
      this.#repository.update(instanceId, (source) => {
        const next = { ...source };
        if (freshnessState) next.freshnessState = freshnessState;
        else delete next.freshnessState;
        return next;
      });
      report.push(Object.freeze({
        instanceId,
        previousPercent: previous,
        currentPercent: freshnessState?.percent ?? 100,
      }));
    }
    return Object.freeze(report);
  }

  confirm({ instanceIds = [], exposureToken = null } = {}) {
    if (!exposureToken) return;
    for (const instanceId of instanceIds || []) {
      if (instanceId) {
        this.#lastExposureTokenByInstance.set(String(instanceId), exposureToken);
      }
    }
  }
}

globalThis.ApplyBaitExposureService = ApplyBaitExposureService;
