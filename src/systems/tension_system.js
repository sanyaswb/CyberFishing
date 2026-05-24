class TensionSystem {
  #calculator = new LineTensionCalculator();

  calculate(context = {}) {
    return this.#calculator.calculate(context);
  }
}
