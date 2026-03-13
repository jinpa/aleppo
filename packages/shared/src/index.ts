export type Ingredient = {
  raw: string;
  amount?: string;
  quantity?: number;
  unit?: string;
  name?: string;
  notes?: string;
};

export type InstructionStep = {
  step: number;
  text: string;
};
