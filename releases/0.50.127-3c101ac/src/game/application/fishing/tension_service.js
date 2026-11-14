import { LineTensionCalculator } from "../../domain/fishing/line_tension_calculator.js";

export class TensionService {
  #calculator = new LineTensionCalculator();

  calculate(context = {}) {
    return this.#calculator.calculate(context);
  }
}
