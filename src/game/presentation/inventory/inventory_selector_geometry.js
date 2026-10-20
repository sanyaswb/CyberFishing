// Unit coordinates are relative to the central button's bottom-right corner.
// Sector SVG, CSS clipping and selection consume these same rounded polygons.
export class InventorySelectorGeometry {
  constructor(config) {
    this.radius = config.outerRadius;
    this.centralRadius = config.centralRadius;
    this.innerRadius = config.centralRadius + config.gap;
    this.retentionRadius = config.outerRadius + config.highlightDistance + config.gap;
    this.retentionPadding = config.gap;
    const centroid = -4 * this.centralRadius / (3 * Math.PI);
    this.central = { center: { x: centroid, y: centroid } };
    const retention = [];
    for (let i = 0; i <= config.arcSteps * 3; i++) {
      const angle = i / (config.arcSteps * 3) * Math.PI / 2;
      retention.push({ x: -this.retentionRadius * Math.cos(angle), y: -this.retentionRadius * Math.sin(angle) });
    }
    retention.push({ x: this.retentionPadding, y: -this.retentionRadius },
      { x: this.retentionPadding, y: this.retentionPadding }, { x: -this.retentionRadius, y: this.retentionPadding });
    this.retention = this.#outline(retention, this.retentionRadius, this.retentionRadius + this.retentionPadding);
    this.sectors = Array.from({ length: config.sectorCount }, (_, index) => this.#sector(config, index));
  }

  contains(x, y) {
    return x <= this.retentionPadding && y <= this.retentionPadding &&
      Math.min(x, 0) ** 2 + Math.min(y, 0) ** 2 <= this.retentionRadius ** 2;
  }

  hitTest(x, y, offsets = null) {
    if (!this.contains(x, y)) return -1;
    return this.sectors.findIndex(({ points, shift }, index) => {
      const px = x - shift.x * (offsets?.[index] || 0), py = y - shift.y * (offsets?.[index] || 0);
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if ((a.y > py) !== (b.y > py) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    });
  }

  #sector(config, index) {
    const { outerRadius: outer, gap, rounding, arcSteps, cornerSteps, sectorCount } = config;
    const inner = this.innerRadius;
    const step = Math.PI / 2 / sectorCount;
    const point = (r, angle) => ({ x: -r * Math.cos(angle), y: -r * Math.sin(angle) });
    const points = [];
    const outerInset = Math.asin(gap / 2 / outer), innerInset = Math.asin(gap / 2 / inner);
    const a0 = index * step + outerInset, a1 = (index + 1) * step - outerInset;
    const b0 = index * step + innerInset, b1 = (index + 1) * step - innerInset;
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
    return { points, center: point((inner + outer) / 2, (index + 0.5) * step),
      shift: point(config.highlightDistance, (index + 0.5) * step),
      ...this.#outline(points, outer) };
  }

  #outline(points, origin, size = origin) {
    return {
      path: `M${points.map(({ x, y }) => `${(x + origin).toFixed(6)},${(y + origin).toFixed(6)}`).join(" L")} Z`,
      clip: `polygon(${points.map(({ x, y }) => `${((x + origin) / size * 100).toFixed(5)}% ${((y + origin) / size * 100).toFixed(5)}%`).join(",")})`,
    };
  }
}
