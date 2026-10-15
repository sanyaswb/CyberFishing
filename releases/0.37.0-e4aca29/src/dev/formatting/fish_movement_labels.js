// DEV labels for the fight diagnostics' fish movement and pressure codes.
const RELATION_LABELS = Object.freeze({
  away_from_player: "від гравця",
  toward_player: "до гравця",
  sideways: "поперек",
});

const DIRECTION_LABELS = Object.freeze({
  up: "вгору",
  up_left: "вгору-вліво",
  up_right: "вгору-вправо",
  left: "вліво",
  right: "вправо",
  down: "вниз",
  down_left: "вниз-вліво",
  down_right: "вниз-вправо",
  none: "немає",
});

export function formatMovementRelation(relation) {
  return RELATION_LABELS[relation] || "немає руху";
}

export function formatPressureRelation(relation) {
  return RELATION_LABELS[relation] || "немає тиску";
}

export function formatEightWayDirection(direction) {
  return DIRECTION_LABELS[direction] || DIRECTION_LABELS.none;
}
