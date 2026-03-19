import { test, expect } from "@playwright/test";
import { formatIngredientDisplay } from "./format-ingredient";

test.describe("formatIngredientDisplay", () => {
  test("formats grams correctly", () => {
    expect(formatIngredientDisplay({ name: "Flour", unit: "g", quantity: 500 })).toBe("Flour 500 g");
  });

  test("converts grams to kilograms when >= 1000", () => {
    expect(formatIngredientDisplay({ name: "Flour", unit: "g", quantity: 1500 })).toBe("Flour 1.5 kg");
  });

  test("formats milliliters correctly", () => {
    expect(formatIngredientDisplay({ name: "Water", unit: "ml", quantity: 250 })).toBe("Water 250 ml");
  });

  test("converts milliliters to liters when >= 1000", () => {
    expect(formatIngredientDisplay({ name: "Water", unit: "ml", quantity: 1250 })).toBe("Water 1.25 L");
  });

  test("formats cups with fractions", () => {
    expect(formatIngredientDisplay({ name: "Sugar", unit: "cup", quantity: 1.5 })).toBe("Sugar 1½ cups");
    expect(formatIngredientDisplay({ name: "Sugar", unit: "cup", quantity: 0.5 })).toBe("Sugar ½ cup");
  });

  test("formats teaspoons with fractions", () => {
    expect(formatIngredientDisplay({ name: "Salt", unit: "tsp", quantity: 0.5 })).toBe("Salt ½ tsp");
    expect(formatIngredientDisplay({ name: "Salt", unit: "tsp", quantity: 0.25 })).toBe("Salt ¼ tsp");
  });

  test("formats tablespoons", () => {
    expect(formatIngredientDisplay({ name: "Honey", unit: "tbsp", quantity: 2 })).toBe("Honey 2 tbsp");
    expect(formatIngredientDisplay({ name: "Honey", unit: "tbsp", quantity: 8 })).toBe("Honey 8 tbsp");
    expect(formatIngredientDisplay({ name: "Honey", unit: "tbsp", quantity: 12 })).toBe("Honey 12 tbsp");
    expect(formatIngredientDisplay({ name: "Honey", unit: "tbsp", quantity: 16 })).toBe("Honey 1 cup");
  });

  test("formats counts correctly", () => {
    expect(formatIngredientDisplay({ name: "Eggs", unit: "count", quantity: 3 })).toBe("Eggs 3");
  });

  test("scales units down (beautify)", () => {
    // 1/16 cup is 1 tablespoon
    expect(formatIngredientDisplay({ name: "Baking Powder", unit: "cup", quantity: 0.0625 })).toBe("Baking Powder 1 tbsp");
    // 1/4 tablespoon is 3/4 teaspoon
    expect(formatIngredientDisplay({ name: "Vanilla", unit: "tbsp", quantity: 0.25 })).toBe("Vanilla ¾ tsp");
  });

  test("handles zero quantity", () => {
    expect(formatIngredientDisplay({ name: "Salt", unit: "g", quantity: 0 })).toBe("Salt");
  });

  test("handles undefined or null name", () => {
    expect(formatIngredientDisplay({ name: undefined as any, unit: "g", quantity: 100 })).toBe("100 g");
  });

  test("handles complex fractions like 1/3 and 2/3", () => {
    expect(formatIngredientDisplay({ name: "Sugar", unit: "cup", quantity: 1/3 })).toBe("Sugar ⅓ cup");
    expect(formatIngredientDisplay({ name: "Sugar", unit: "cup", quantity: 2/3 })).toBe("Sugar ⅔ cup");
  });

  test("handles complex fractions like 1/8", () => {
    expect(formatIngredientDisplay({ name: "Cinnamon", unit: "tsp", quantity: 0.125 })).toBe("Cinnamon ⅛ tsp");
  });
});
