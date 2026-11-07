// Pixi Graphics has no line dash (Canvas 2D's setLineDash), so a dashed segment is drawn as its dashes (spec 107 D2).
// pattern: [dash, gap, dash, gap, ...] in logical px, the Canvas 2D convention; an empty pattern draws a solid line.
// The caller strokes the resulting path once.
export function appendDashedLine(graphics, x1, y1, x2, y2, pattern) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (!(length > 0)) return;
  if (!pattern || pattern.length === 0) {
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    return;
  }
  const unitX = (x2 - x1) / length;
  const unitY = (y2 - y1) / length;
  let along = 0;
  let index = 0;
  let drawing = true;
  while (along < length) {
    const step = Math.max(0.01, Number(pattern[index % pattern.length]) || 0);
    const end = Math.min(length, along + step);
    if (drawing) {
      graphics.moveTo(x1 + unitX * along, y1 + unitY * along);
      graphics.lineTo(x1 + unitX * end, y1 + unitY * end);
    }
    along = end;
    index += 1;
    drawing = !drawing;
  }
}
