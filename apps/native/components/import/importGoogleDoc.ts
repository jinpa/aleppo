import { Platform } from "react-native";
import { API_URL } from "@/constants/api";
import type { ImportOutcome } from "./types";
import type { ScrapedRecipe } from "@aleppo/shared";

export function isGoogleDocUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /docs\.google\.com\/document\/d\//.test(parsed.hostname + parsed.pathname);
  } catch {
    return false;
  }
}

export async function importGoogleDoc(
  docUrl: string,
  opts: {
    token: string | null;
    language?: string;
    onComplete: (outcome: ImportOutcome) => void;
    onBatchComplete?: (recipes: ScrapedRecipe[]) => void;
  }
): Promise<void> {
  const { token, language, onComplete, onBatchComplete } = opts;
  const currentToken = Platform.OS === "web" ? localStorage.getItem("auth_token") : token;
  try {
    const res = await fetch(`${API_URL}/api/import/google-doc`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: docUrl, language }),
    });
    const data = await res.json();
    if (!res.ok) {
      onComplete({
        ok: false,
        error: res.status === 401
          ? "Authentication error — please try again."
          : data.error ?? "Google Doc import failed.",
      });
    } else if (Array.isArray(data.recipes) && data.recipes.length > 1 && onBatchComplete) {
      onBatchComplete(data.recipes);
    } else if (Array.isArray(data.recipes) && data.recipes.length > 0) {
      onComplete({
        ok: true,
        recipe: { ...data.recipes[0], sourceUrl: docUrl },
        aiGenerated: data.generated,
      });
    } else {
      onComplete({ ok: false, error: "No recipes found in the document." });
    }
  } catch {
    onComplete({ ok: false, error: "Could not connect to server." });
  }
}
