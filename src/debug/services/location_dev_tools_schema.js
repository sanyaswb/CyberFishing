class LocationDevToolsSchema {
  #groups = Object.freeze([
    Object.freeze({
      title: "Master visibility",
      keys: Object.freeze([
        "debugVisuals",
        "debugZones",
        "debugGrid",
        "debugDepthText",
      ]),
    }),
    Object.freeze({
      title: "Gameplay zones",
      keys: Object.freeze([
        "enableCastable",
        "enableCollisions",
        "enableSnags",
        "enableDynamicZones",
      ]),
    }),
    Object.freeze({
      title: "Zone overlays",
      keys: Object.freeze([
        "showChumZones",
        "showCatchZone",
        "showLastDashZone",
        "showNetZone",
        "showAimingZone",
        "showPoleFightSector",
        "showFightLineRadius",
      ]),
    }),
  ]);

  get rootTitle() {
    return "Locations / Zones";
  }

  getGroups() {
    return this.#groups;
  }
}

if (typeof window !== "undefined") {
  window.LocationDevToolsSchema = LocationDevToolsSchema;
}
