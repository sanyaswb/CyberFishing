export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  // ДОДАНО: Потрібен для скидання або встановлення значень без створення нового об'єкта
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  // ДОДАНО: Копіювання значень з іншого вектора (дуже корисно для оптимізації)
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  // ДОДАНО: Віднімання (часто потрібне у фізиці)
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }

  normalize() {
    const length = Math.hypot(this.x, this.y);
    if (length > 0) {
      this.x /= length;
      this.y /= length;
    }
    return this;
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  clone() {
    return new Vector2(this.x, this.y);
  }
}
