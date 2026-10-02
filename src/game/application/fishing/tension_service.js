import { LineTensionCalculator } from "../../domain/fishing/line_tension_calculator.js";

export class TensionSystem {
  #calculator = new LineTensionCalculator();

  calculate(context = {}) {
    return this.#calculator.calculate(context);
  }
}
