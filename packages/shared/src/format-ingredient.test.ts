import { describe, it, expect } from "vitest";
import { formatIngredientDisplay } from "./format-ingredient";

describe("formatIngredientDisplay", () => {
  it("formats grams correctly", () => {
    expect(formatIngredientDisplay({ name: "Flour", unit: "g", quantity: 500 })).toBe("Flour 500 g");
  });

  it("converts grams to kilograms when >= 1000", () => {
    expect(formatIngredientDisplay({ name: "Flour", unit: "g", quantity: 1500 })).toBe("Flour 1.5 kg");
  });

  it("formats milliliters correctly", () => {
    expect(formatIngredientDisplay({ name: "Water", unit: "ml", quantity: 250 })).toBe("Water 250 ml");
  });

  it("converts milliliters to liters when >= 1000", () => {
    expect(formatIngredientDisplay({ name: "Water", unit: "ml", quantity: 1250 })).toBe("Water 1.25 L");
  });

  it("formats cups with fractions", () => {
    expect(formatIngredientDisplay({ name: "Sugar", unit: "cup", quantity: 1.5 })).toBe("Sugar 1½ cups");
    expect(formatIngredientDisplay({ name: "Sugar", unit: "cup", quantity: 0.5 })).toBe("Sugar ½ cup");
  });

  it("formats teaspoons with fractions", () => {
    expect(formatIngredientDisplay({ name: "Salt", unit: "tsp", quantity: 0.5 })).toBe("Salt ½ tsp");
    expect(formatIngredientDisplay({ name: "Salt", unit: "tsp", quantity: 0.25 })).toBe("Salt ¼ tsp");
  });

  it("formats tablespoons", () => {
    expect(formatIngredientDisplay({ name: "Honey", unit: "tbsp", quantity: 2 })).toBe("Honey 2 tbsp");
  });

  it("formats counts correctly", () => {
    expect(formatIngredientDisplay({ name: "Eggs", unit: "count", quantity: 3 })).toBe("Eggs 3");
  });

  it("scales units down (beautify)", () => {
    // 1/16 cup is 1 tablespoon
    expect(formatIngredientDisplay({ name: "Baking Powder", unit: "cup", quantity: 0.0625 })).toBe("Baking Powder 1 tbsp");
    // 1/4 tablespoon is 3/4 teaspoon
    expect(formatIngredientDisplay({ name: "Vanilla", unit: "tbsp", quantity: 0.25 })).toBe("Vanilla ¾ tsp");
  });

  it("handles zero quantity", () => {
    expect(formatIngredientDisplay({ name: "Salt", unit: "g", quantity: 0 })).toBe("Salt");
  });

  it("handles undefined or null name", () => {
    expect(formatIngredientDisplay({ name: undefined as any, unit: "g", quantity: 100 })).toBe("100 g");
  });

  it("handles complex fractions like 1/3 and 2/3", () => {
    expect(formatIngredientDisplay({ name: "Sugar", unit: "cup", quantity: 1/3 })).toBe("Sugar ⅓ cup");
    expect(formatIngredientDisplay({ name: "Sugar", unit: "cup", quantity: 2/3 })).toBe("Sugar ⅔ cup");
  });

  it("handles complex fractions like 1/8", () => {
    expect(formatIngredientDisplay({ name: "Cinnamon", unit: "tsp", quantity: 0.125 })).toBe("Cinnamon ⅛ tsp");
  });
});
