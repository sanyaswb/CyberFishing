export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  // Reset coordinates without allocating another vector.
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  // Copy coordinates while reusing this vector.
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
