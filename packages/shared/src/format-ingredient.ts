import { Ingredient } from "./types";

enum IngredientUnits {
  grams = "grams",
  kilograms = "kilograms",
  ounces = "ounces",
  pounds = "pounds",
  cups = "cups",
  tablespoons = "tablespoons",
  teaspoons = "teaspoons",
  liters = "liters",
  deciliters = "deciliters",
  centiliters = "centiliters",
  milliliters = "milliliters",
  count = "count",
  some = "some",
}

const UNIT_MAP: Record<string, IngredientUnits> = {
  g: IngredientUnits.grams,
  gram: IngredientUnits.grams,
  grams: IngredientUnits.grams,
  kg: IngredientUnits.kilograms,
  kilogram: IngredientUnits.kilograms,
  kilograms: IngredientUnits.kilograms,
  oz: IngredientUnits.ounces,
  ounce: IngredientUnits.ounces,
  ounces: IngredientUnits.ounces,
  lb: IngredientUnits.pounds,
  pound: IngredientUnits.pounds,
  pounds: IngredientUnits.pounds,
  cup: IngredientUnits.cups,
  cups: IngredientUnits.cups,
  tbsp: IngredientUnits.tablespoons,
  tablespoon: IngredientUnits.tablespoons,
  tablespoons: IngredientUnits.tablespoons,
  tsp: IngredientUnits.teaspoons,
  teaspoon: IngredientUnits.teaspoons,
  teaspoons: IngredientUnits.teaspoons,
  l: IngredientUnits.liters,
  liter: IngredientUnits.liters,
  liters: IngredientUnits.liters,
  dl: IngredientUnits.deciliters,
  deciliter: IngredientUnits.deciliters,
  deciliters: IngredientUnits.deciliters,
  cl: IngredientUnits.centiliters,
  centiliter: IngredientUnits.centiliters,
  centiliters: IngredientUnits.centiliters,
  ml: IngredientUnits.milliliters,
  milliliter: IngredientUnits.milliliters,
  milliliters: IngredientUnits.milliliters,
};

const UNIT_LABELS: Record<IngredientUnits, string> = {
  [IngredientUnits.grams]: "g",
  [IngredientUnits.kilograms]: "kg",
  [IngredientUnits.ounces]: "oz",
  [IngredientUnits.pounds]: "lb",
  [IngredientUnits.cups]: "cups", // We'll handle pluralization in the logic if needed, but keeping it simple for now
  [IngredientUnits.tablespoons]: "tbsp",
  [IngredientUnits.teaspoons]: "tsp",
  [IngredientUnits.liters]: "L",
  [IngredientUnits.deciliters]: "dl",
  [IngredientUnits.centiliters]: "cl",
  [IngredientUnits.milliliters]: "ml",
  [IngredientUnits.count]: "",
  [IngredientUnits.some]: "",
};

function normalizeUnit(unit: string | undefined): IngredientUnits {
  if (!unit) return IngredientUnits.count;
  const normalized = unit.toLowerCase().trim();
  return UNIT_MAP[normalized] || IngredientUnits.count;
}

function normalize(amount: number, unit: IngredientUnits): { amount: number; unit: IngredientUnits } {
  switch (unit) {
    case IngredientUnits.kilograms:
      return { amount: amount * 1000, unit: IngredientUnits.grams };
    case IngredientUnits.pounds:
      return { amount: amount * 16, unit: IngredientUnits.ounces };
    case IngredientUnits.tablespoons:
      return { amount: amount / 16, unit: IngredientUnits.cups };
    case IngredientUnits.teaspoons:
      return { amount: amount / 48, unit: IngredientUnits.cups };
    case IngredientUnits.deciliters:
      return { amount: amount / 10, unit: IngredientUnits.liters };
    case IngredientUnits.centiliters:
      return { amount: amount / 100, unit: IngredientUnits.liters };
    case IngredientUnits.milliliters:
      return { amount: amount / 1000, unit: IngredientUnits.liters };
    default:
      return { amount, unit };
  }
}

function beautify(amount: number, unit: IngredientUnits): { amount: number; unit: IngredientUnits } {
  const originalUnits = unit;
  const norm = normalize(amount, unit);

  switch (norm.unit) {
    case IngredientUnits.grams:
      if (norm.amount >= 1000) {
        return { amount: norm.amount / 1000, unit: IngredientUnits.kilograms };
      }
      return norm;
    case IngredientUnits.ounces:
      if (norm.amount >= 16) {
        return { amount: norm.amount / 16, unit: IngredientUnits.pounds };
      }
      return norm;
    case IngredientUnits.cups:
      // If the original unit was not "cups" (it was spoons) keep using spoons
      // till 1 cup. If it was "cups", start using spoons below 1/4 cups.
      if ((originalUnits == IngredientUnits.cups && norm.amount >= 0.25) ||
          norm.amount >= 1.0) {
        return norm;
      } else {
        const tbsps = norm.amount * 16.0;
        if (tbsps >= 1.0) {
          return { amount: tbsps, unit: IngredientUnits.tablespoons };
        } else {
          return { amount: norm.amount * 48.0, unit: IngredientUnits.teaspoons };
        }
      }
    case IngredientUnits.liters:
      if (norm.amount >= 1.0) {
        return norm;
      } else {
        return { amount: norm.amount * 1000, unit: IngredientUnits.milliliters };
      }
    default:
      return norm;
  }
}

function roundToDigits(x: number, digits: number): number {
  if (x === 0 || !Number.isFinite(x)) return 0;
  const mag = Math.floor(Math.log10(Math.abs(x)));
  const m = 1.0 / Math.pow(10.0, mag - (Math.floor(digits) - 1));
  const half = digits !== Math.floor(digits);
  if (half) {
    return Math.round(x * m * 2) / (m * 2);
  } else {
    return Math.round(x * m) / m;
  }
}

function formatDouble(value: number, digits: number): string {
  const rounded = roundToDigits(value, digits);
  if (Math.abs(rounded - Math.round(rounded)) < 0.01) {
    return Math.round(rounded).toString();
  }
  return rounded.toString();
}

class WholeAndFraction {
  constructor(
    public whole: number,
    public fractionNum: number,
    public fractionDenum: number
  ) {}

  static fromDouble(value: number, maxDenum: number = 8): WholeAndFraction {
    if (value === 0) return new WholeAndFraction(0, 0, 1);

    let whole = Math.trunc(value);
    const fraction = value - whole;

    if (fraction === 0) return new WholeAndFraction(whole, 0, 1);

    let error = 1.0;
    let bestDenum = 1;
    let bestNum = 0;

    const denums = [1, 2, 3, 4];
    if (whole < 1.0) {
      denums.push(8);
    }

    for (const denum of denums) {
      if (denum > maxDenum) continue;
      const val = 1 / denum;
      const count = Math.round(fraction / val);
      const approx = count * val;
      const thisError = Math.abs(approx - fraction);
      if (thisError < error) {
        bestDenum = denum;
        bestNum = count;
        error = thisError;
      }
    }

    if (bestDenum === 1 && bestNum === 1) {
      whole += 1;
      bestNum = 0;
    } else if (whole === 0 && bestNum === 0) {
      bestNum = 1;
      bestDenum = Math.round(maxDenum);
    }

    return new WholeAndFraction(whole, bestNum, bestDenum);
  }

  private static FRACTION_STRINGS: Record<number, Record<number, string>> = {
    2: { 1: "½" },
    3: { 1: "⅓", 2: "⅔" },
    4: { 1: "¼", 3: "¾" },
    8: { 1: "⅛", 3: "⅜", 5: "⅝", 7: "⅞" },
  };

  toString(): string {
    if (this.fractionNum === 0) return this.whole.toString();
    const fraction =
      WholeAndFraction.FRACTION_STRINGS[this.fractionDenum]?.[this.fractionNum] ||
      `${this.fractionNum}/${this.fractionDenum}`;
    if (this.whole === 0) return fraction;
    return `${this.whole}${fraction}`;
  }
}

function formatAmount(amount: number, unit: IngredientUnits): string {
  switch (unit) {
    case IngredientUnits.kilograms:
    case IngredientUnits.grams:
      return formatDouble(amount, 2.5);
    case IngredientUnits.pounds:
    case IngredientUnits.ounces:
    case IngredientUnits.teaspoons:
      return WholeAndFraction.fromDouble(amount).toString();
    case IngredientUnits.cups:
      // In Dart, cups uses pluralized units for "cup", but here we keep it simple or use abbreviations.
      // WholeAndFraction.fromDouble(amount).toString()
      return WholeAndFraction.fromDouble(amount).toString();
    case IngredientUnits.tablespoons:
    case IngredientUnits.count:
      return WholeAndFraction.fromDouble(amount, 2).toString();
    case IngredientUnits.liters:
    case IngredientUnits.deciliters:
    case IngredientUnits.centiliters:
    case IngredientUnits.milliliters:
      return formatDouble(amount, 2.5);
    default:
      return "";
  }
}

function getUnitLabel(unit: IngredientUnits, amount: number): string {
  if (unit === IngredientUnits.cups) {
    return amount <= 1.0 ? "cup" : "cups";
  }
  return UNIT_LABELS[unit];
}

/**
 * Formats an Aleppo ingredient into a display string.
 * Mimics the smart_scaler Dart implementation.
 */
export function formatIngredientDisplay(ingredient: Pick<Ingredient, "name" | "unit" | "quantity">): string {
  const { name, unit: rawUnit, quantity } = ingredient;
  
  if (quantity === undefined || quantity === null || quantity === 0) {
    return name || "";
  }

  const initialUnit = normalizeUnit(rawUnit);
  const { amount: beautyAmount, unit: beautyUnit } = beautify(quantity, initialUnit);
  
  const amountStr = formatAmount(beautyAmount, beautyUnit);
  const unitLabel = getUnitLabel(beautyUnit, beautyAmount);

  const parts: string[] = [];
  if (name) parts.push(name);
  if (amountStr) parts.push(amountStr);
  if (unitLabel) parts.push(unitLabel);

  return parts.join(" ");
}
