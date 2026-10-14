// Inventory sections in tab order; icons are symbols of assets/ui/inventory-sections.svg.
export const INVENTORY_SECTIONS = Object.freeze({
  label: "Розділи інвентарю",
  iconSprite: "assets/ui/inventory-sections.svg",
  defaultSectionId: "equipment",
  backpackImage: "assets/ui/inventory/backpack.svg",
  labels: Object.freeze({
    backpackItems: (count) => `Предметів у рюкзаку: ${count}`,
  }),
  items: Object.freeze([
    Object.freeze({ id: "equipment", icon: "equipment", label: "Екіпіровка" }),
    Object.freeze({ id: "backpack", icon: "backpack", label: "Рюкзак" }),
    Object.freeze({ id: "keepnet", icon: "keepnet", label: "Садок" }),
  ]),
});
