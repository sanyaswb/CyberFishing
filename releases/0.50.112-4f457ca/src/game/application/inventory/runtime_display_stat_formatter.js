export class RuntimeDisplayStatFormatter {
  formatMeters(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }

  formatCoefficient(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }
}
