class OverlayValueFormatter {
  num(value, digits = 2) {
    const parsed = Number(value);
    return (Number.isFinite(parsed) ? parsed : 0).toFixed(digits);
  }

  kg(value, digits = 3) {
    return `${this.num(value, digits)}кг`;
  }

  kgPerKg(value) {
    return `${this.num(value, 3)}кг/кг`;
  }

  kgPerKgMps(value) {
    return `${this.num(value, 3)}кг/кг/м·с⁻¹`;
  }

  meters(value, digits = 2) {
    return `${this.num(value, digits)}м`;
  }

  mps(value, digits = 2) {
    return `${this.num(value, digits)}м/с`;
  }

  seconds(valueMs) {
    return `${this.num((Number(valueMs) || 0) / 1000, 1)}с`;
  }

  percent(value, digits = 1) {
    return `${this.num((Number(value) || 0) * 100, digits)}%`;
  }

  stressColor(ratio) {
    const value = Number(ratio) || 0;
    if (value >= 1) return "#ff4444";
    if (value >= 0.8) return "#ffaa00";
    return "#00ff80";
  }

  netForceColor(netForceKg) {
    const force = Number(netForceKg) || 0;
    if (force > 0.001) return "#00ff80";
    if (force < -0.001) return "#ff8888";
    return "#ffaa00";
  }

  winner(netForceKg) {
    const force = Number(netForceKg) || 0;
    if (force > 0.001) return "Player";
    if (force < -0.001) return "Fish";
    return "Balanced";
  }
}

window.OverlayValueFormatter = OverlayValueFormatter;
