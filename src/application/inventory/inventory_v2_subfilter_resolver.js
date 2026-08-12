class InventoryV2SubfilterResolver {
  static DEFAULT_GROUPS = Object.freeze({
    spinning: Object.freeze({ id: "spinning-rods", label: "Спінінги" }),
    feeder: Object.freeze({ id: "feeder-rods", label: "Фідери" }),
    float: Object.freeze({ id: "float-rods", label: "Поплавкові вудки" }),
    pole: Object.freeze({ id: "pole-rods", label: "Махові" }),
    match: Object.freeze({ id: "match-rods", label: "Матчеві" }),
    bolognese: Object.freeze({ id: "bolognese-rods", label: "Болонські" }),
    spinning_reel: Object.freeze({ id: "reels", label: "Котушки" }),
    fishing_line: Object.freeze({ id: "fishing-lines", label: "Ліски" }),
    leader_line: Object.freeze({ id: "leaders", label: "Поводки" }),
    float_tackle: Object.freeze({ id: "floats", label: "Поплавки" }),
    day: Object.freeze({ id: "floats", label: "Поплавки" }),
    night: Object.freeze({ id: "floats", label: "Поплавки" }),
    hook: Object.freeze({ id: "hooks", label: "Гачки" }),
    feeder_rig: Object.freeze({ id: "feeder-tackle", label: "Фідерні снасті" }),
    spring: Object.freeze({ id: "feeder-tackle", label: "Фідерні снасті" }),
    feeder_tackle: Object.freeze({ id: "feeder-tackle", label: "Фідерні снасті" }),
    lure: Object.freeze({ id: "spinning-lures", label: "Спінінгові приманки" }),
    spinner: Object.freeze({ id: "spinning-lures", label: "Спінінгові приманки" }),
    wobbler: Object.freeze({ id: "spinning-lures", label: "Спінінгові приманки" }),
    jig: Object.freeze({ id: "spinning-lures", label: "Спінінгові приманки" }),
    bait: Object.freeze({ id: "baits", label: "Наживки" }),
    fishing_bait: Object.freeze({ id: "baits", label: "Наживки" }),
    chum_mix: Object.freeze({ id: "chums", label: "Прикормки" }),
    groundbait: Object.freeze({ id: "chums", label: "Прикормки" }),
    boat: Object.freeze({ id: "boats", label: "Кораблики" }),
    chum_delivery: Object.freeze({ id: "boats", label: "Кораблики" }),
    net: Object.freeze({ id: "nets", label: "Підсаки" }),
    gas_mask: Object.freeze({ id: "gas-masks", label: "Протигази" }),
  });

  #groups;

  constructor({ groups = InventoryV2SubfilterResolver.DEFAULT_GROUPS } = {}) {
    this.#groups = groups;
  }

  resolve(item, { categoryId = "all" } = {}) {
    if (!item) return null;
    const itemType = item.itemType ?? null;
    const groupingType = item.variant || itemType;
    if (itemType === "equipment_loadout") {
      if (categoryId !== "loadouts") return null;
      const name = String(item.name || "Комплект").trim() || "Комплект";
      return Object.freeze({
        id: `loadout-name:${name.toLocaleLowerCase("uk-UA")}`,
        label: name,
      });
    }
    const configured = this.#groups[groupingType];
    if (configured) return configured;
    if (!groupingType) return null;
    return Object.freeze({
      id: `type:${groupingType}`,
      label: String(groupingType),
    });
  }
}

globalThis.InventoryV2SubfilterResolver = InventoryV2SubfilterResolver;
