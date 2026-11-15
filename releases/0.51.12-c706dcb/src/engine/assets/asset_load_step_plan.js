// The steps of an asset load plan in the order GameAssetPreloadFacade loads them (spec 167): the layers that start with
// the composition (the first frame), then the first layer's full files that replace its low copies ("upgrade"), then
// every other layer in plan order (a layer may only start after an earlier one). A layer's step is one priority (all its
// groups of that priority load together); a lazy layer has a low-copy pass and then a full pass over the priorities of
// the groups it loads. Pure, without text: the DEV step viewer names and releases these steps one by one; the facade
// names them by stepId().

export class AssetLoadStepPlan {
  #steps;

  // A step's id as the facade asks for it.
  static stepId(layerId, pass, priority = null) {
    return pass === "upgrade" ? "upgrade" : `${layerId}:${pass}:${priority}`;
  }

  // plan: AssetLoadPlan (its layers with the groups sorted by priority, the implicit "unassigned" group included).
  constructor(plan) {
    const layers = plan.layers;
    const first = layers.filter((layer) => layer.start === "composition");
    const rest = layers.filter((layer) => layer.start !== "composition");
    const steps = [];
    const add = (layer, pass, priority, groups, auto) => steps.push(Object.freeze({
      id: AssetLoadStepPlan.stepId(layer.id, pass, priority), index: steps.length, layerId: layer.id,
      layerLabel: layer.label, pass, priority, auto, groupIds: Object.freeze(groups.map((group) => group.id)),
      groupLabels: Object.freeze(groups.map((group) => group.label)),
    }));
    const addLayer = (layer, auto) => {
      const groups = layer.lazy ? layer.groups.filter((group) => group.load) : layer.groups;
      const priorities = [...new Set(groups.map((group) => group.priority))];
      for (const pass of layer.lazy ? ["low", "full"] : ["load"]) {
        for (const priority of priorities) add(layer, pass, priority, groups.filter((group) => group.priority === priority), auto);
      }
    };
    for (const layer of first) addLayer(layer, true);
    // The facade upgrades only the plan's first layer, and only when a later layer starts (after the first frame).
    const upgraded = layers[0].groups.filter((group) => group.load && group.readyOn === "low" && group.upgrade !== "on-demand");
    if (layers[0].start === "composition" && upgraded.length > 0) add(layers[0], "upgrade", null, upgraded, false);
    for (const layer of rest) addLayer(layer, false);
    this.#steps = Object.freeze(steps);
  }

  get steps() {
    return this.#steps;
  }
}
