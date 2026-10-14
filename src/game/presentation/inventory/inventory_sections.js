// Inventory sections in tab order; icons are symbols of assets/ui/inventory-sections.svg. The root modifier and host
// class names are literal so the style guard can reach them (spec 068).
export const INVENTORY_SECTIONS = Object.freeze({
  label: "Розділи інвентарю",
  iconSprite: "assets/ui/inventory-sections.svg",
  defaultSectionId: "equipment",
  backpackImage: "assets/ui/inventory/backpack.svg",
  labels: Object.freeze({
    backpackItems: (count) => `Предметів у рюкзаку: ${count}`,
  }),
  items: Object.freeze([
    Object.freeze({ id: "equipment", icon: "equipment", label: "Екіпіровка",
      modifier: "inventory-modal--section-equipment", hostClass: "inventory-main__section--equipment" }),
    Object.freeze({ id: "backpack", icon: "backpack", label: "Рюкзак",
      modifier: "inventory-modal--section-backpack", hostClass: "inventory-main__section--backpack" }),
    Object.freeze({ id: "keepnet", icon: "keepnet", label: "Садок",
      modifier: "inventory-modal--section-keepnet", hostClass: "inventory-main__section--keepnet" }),
  ]),
});
