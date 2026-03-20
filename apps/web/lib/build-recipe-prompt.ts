import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "lib/prompts");

export function buildPrompt(
  options: { inputText?: string; language?: string; mode?: "image" | "video" } = {}
): string {
  const { inputText, language, mode = "image" } = options;

  const prefix = fs.readFileSync(path.join(PROMPTS_DIR, "prefix.txt"), "utf-8");

  const shotFiles = fs
    .readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const shots = shotFiles
    .map((f) => {
      const content = fs.readFileSync(path.join(PROMPTS_DIR, f), "utf-8");
      return `---\nEXAMPLE:\n${content}`;
    })
    .join("\n");

  const instructions = fs.readFileSync(
    path.join(PROMPTS_DIR, "instructions.txt"),
    "utf-8"
  );

  const translate = language
    ? `0- Translate the recipe (title, description, ingredients, instructions) to ${language}.\n`
    : "0- Keep the recipe in its original language.\n";

  const base = `${prefix}\n${shots}\n---\nRULES:\n${translate}\n${instructions}\n---\n`;

  if (inputText) {
    return `${base}Process the following text and output the recipe JSON.\nTEXT: ${inputText}\nJSON:`;
  }
  if (mode === "video") {
    return `${base}Process the provided video and output the recipe JSON.\nAlso include "bestFrameTimestamp": <number> in the JSON — the number of seconds from the START of the video to the frame that best shows the finished dish or food. This must be less than the video's total duration. Pick the most appetizing, well-lit shot.\nJSON:`;
  }
  return `${base}Process the provided images and output the recipe JSON.\nJSON:`;
}
