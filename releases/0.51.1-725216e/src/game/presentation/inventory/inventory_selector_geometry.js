// Unit coordinates are relative to the fan centre: the layout's `origin`, a share of the central button's box
// (the corner fans' bottom corner, the centred fans' bottom centre or box centre).
// Sector SVG, CSS clipping and selection consume these same rounded polygons; each outline is drawn in its own
// bounding box (`box`, relative to the origin), which the renderer places over the central button's box.
export class InventorySelectorGeometry {
  constructor(config, layout = "corner") {
    const fan = config.layouts[layout];
    this.layout = layout;
    this.origin = fan.origin;
    this.radius = fan.outerRadius;
    this.centralRadius = fan.centralRadius;
    this.innerRadius = fan.centralRadius + config.gap;
    this.retentionRadius = fan.outerRadius + config.highlightDistance + config.gap;
    this.retentionPadding = config.gap;
    this.startAngle = fan.startAngle * Math.PI / 180;
    this.endAngle = fan.endAngle * Math.PI / 180;
    this.box = this.#arcBounds([this.innerRadius, this.radius]);
    const centralBox = { minX: -fan.origin.x, minY: -fan.origin.y, maxX: 1 - fan.origin.x, maxY: 1 - fan.origin.y };
    // The open central button: a disk (centred art) or the disk sector under the fan (art at its centroid).
    const half = (this.endAngle - this.startAngle) / 2, middle = this.startAngle + half;
    const centroid = fan.centralDisk ? 0 : 2 * this.centralRadius * Math.sin(half) / (3 * half);
    this.central = { center: this.#point(centroid, middle),
      box: fan.centralDisk ? centralBox : this.#arcBounds([0, this.centralRadius]) };
    const retention = [];
    const steps = config.arcSteps * 3;
    for (let i = 0; i <= steps; i++) retention.push(this.#point(this.retentionRadius, this.startAngle + (this.endAngle - this.startAngle) * i / steps));
    const start = retention[0], end = retention[retention.length - 1];
    const right = Math.max(end.x, centralBox.maxX + this.retentionPadding);
    const left = Math.min(start.x, centralBox.minX - this.retentionPadding);
    const bottom = centralBox.maxY + this.retentionPadding;
    if (right !== end.x) retention.push({ x: right, y: end.y });
    retention.push({ x: right, y: bottom }, { x: left, y: bottom });
    if (left !== start.x) retention.push({ x: left, y: start.y });
    this.retentionPoints = retention;
    const top = Math.min(...retention.map(({ y }) => y));
    this.retentionBox = { minX: left, minY: top, maxX: right, maxY: bottom };
    // The open fan's footprint in units: full width, and height above the central button's bottom edge.
    this.extent = { width: right - left, height: centralBox.maxY - top };
    this.retention = this.#outline(retention, this.retentionBox);
    this.sectors = Array.from({ length: config.sectorCount }, (_, index) => this.#sector(config, index));
    if (fan.reverse) this.sectors.reverse();
  }

  contains(x, y) {
    return this.#inside(this.retentionPoints, x, y);
  }

  hitTest(x, y, offsets = null) {
    if (!this.contains(x, y)) return -1;
    return this.sectors.findIndex(({ points, shift }, index) =>
      this.#inside(points, x - shift.x * (offsets?.[index] || 0), y - shift.y * (offsets?.[index] || 0)));
  }

  #inside(points, px, py) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a.y > py) !== (b.y > py) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  #point(r, angle) { return { x: -r * Math.cos(angle), y: -r * Math.sin(angle) }; }

  // Bounding box of the arcs at the given radii between the fan's angles, including their axis extremes.
  #arcBounds(radii) {
    const angles = [this.startAngle, this.endAngle];
    for (let k = 0; k <= 4; k++) if (k * Math.PI / 2 > this.startAngle && k * Math.PI / 2 < this.endAngle) angles.push(k * Math.PI / 2);
    const points = radii.flatMap(r => angles.map(angle => this.#point(r, angle)));
    const round = value => Math.abs(value) < 1e-12 ? 0 : value;
    return { minX: round(Math.min(...points.map(({ x }) => x))), minY: round(Math.min(...points.map(({ y }) => y))),
      maxX: round(Math.max(...points.map(({ x }) => x))), maxY: round(Math.max(...points.map(({ y }) => y))) };
  }

  #sector(config, index) {
    const { gap, rounding, arcSteps, cornerSteps, sectorCount } = config;
    const outer = this.radius, inner = this.innerRadius;
    const step = (this.endAngle - this.startAngle) / sectorCount;
    const point = (r, angle) => this.#point(r, angle);
    const points = [];
    const outerInset = Math.asin(gap / 2 / outer), innerInset = Math.asin(gap / 2 / inner);
    const first = this.startAngle + index * step, last = this.startAngle + (index + 1) * step;
    const a0 = first + outerInset, a1 = last - outerInset;
    const b0 = first + innerInset, b1 = last - innerInset;
    const outerStart = point(outer, a0), outerEnd = point(outer, a1);
    const innerStart = point(inner, b0), innerEnd = point(inner, b1);
    const trim = (corner, neighbour) => {
      const share = rounding / Math.hypot(neighbour.x - corner.x, neighbour.y - corner.y);
      return { x: corner.x + (neighbour.x - corner.x) * share, y: corner.y + (neighbour.y - corner.y) * share };
    };
    const arc = (radius, start, end) => {
      for (let i = 0; i <= arcSteps; i++) points.push(point(radius, start + (end - start) * i / arcSteps));
    };
    const corner = (control, b) => {
      const a = points[points.length - 1];
      for (let k = 1; k <= cornerSteps; k++) {
        const t = k / cornerSteps, u = 1 - t;
        points.push({ x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
          y: u * u * a.y + 2 * u * t * control.y + t * t * b.y });
      }
    };
    arc(outer, a0 + rounding / outer, a1 - rounding / outer);
    corner(outerEnd, trim(outerEnd, innerEnd));
    points.push(trim(innerEnd, outerEnd));
    corner(innerEnd, point(inner, b1 - rounding / inner));
    arc(inner, b1 - rounding / inner, b0 + rounding / inner);
    corner(innerStart, trim(innerStart, outerStart));
    points.push(trim(outerStart, innerStart));
    corner(outerStart, points[0]);
    return { points, center: point((inner + outer) / 2, first + step / 2),
      shift: point(config.highlightDistance, first + step / 2),
      ...this.#outline(points, this.box) };
  }

  #outline(points, box) {
    const width = box.maxX - box.minX, height = box.maxY - box.minY;
    return {
      path: `M${points.map(({ x, y }) => `${(x - box.minX).toFixed(6)},${(y - box.minY).toFixed(6)}`).join(" L")} Z`,
      clip: `polygon(${points.map(({ x, y }) => `${((x - box.minX) / width * 100).toFixed(5)}% ${((y - box.minY) / height * 100).toFixed(5)}%`).join(",")})`,
    };
  }
}
