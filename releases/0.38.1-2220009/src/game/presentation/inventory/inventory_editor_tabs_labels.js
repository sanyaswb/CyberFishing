// Texts of the phone item editor's tabs (spec 091). Tabs show icons; names stay in accessible names and hints.
export const INVENTORY_EDITOR_TABS_LABELS = Object.freeze({
  row: "Предмет і його комірки",
  panel: "Параметри вибраної вкладки",
  root: (name) => `${name} · основний предмет`,
  view: (name) => `${name} · лише параметри`,
  emptyCell: (label) => `${label}: комірка порожня`,
  noParameters: (name) => `${name}: параметрів немає`,
});
