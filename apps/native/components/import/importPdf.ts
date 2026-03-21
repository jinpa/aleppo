import { Platform } from "react-native";
import { API_URL } from "@/constants/api";
import type { ImportOutcome } from "./types";
import type { ScrapedRecipe } from "@aleppo/shared";

export function isGoogleDriveFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /drive\.google\.com\/file\/d\//.test(parsed.hostname + parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Import a PDF from a Google Drive file URL.
 * Sends the URL to the server which downloads and processes it.
 */
export async function importGoogleDrivePdf(
  driveUrl: string,
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
    const form = new FormData();
    form.append("url", driveUrl);
    if (language) form.append("language", language);
    const res = await fetch(`${API_URL}/api/import/pdf`, {
      method: "POST",
      headers: { Authorization: `Bearer ${currentToken}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) {
      onComplete({
        ok: false,
        error: res.status === 401
          ? "Authentication error — please try again."
          : data.error ?? "Google Drive PDF import failed.",
      });
    } else if (Array.isArray(data.recipes) && data.recipes.length > 1 && onBatchComplete) {
      onBatchComplete(data.recipes);
    } else if (Array.isArray(data.recipes) && data.recipes.length > 0) {
      onComplete({
        ok: true,
        recipe: { ...data.recipes[0], sourceUrl: driveUrl },
        aiGenerated: data.generated,
      });
    } else {
      onComplete({ ok: false, error: "No recipes found in the PDF." });
    }
  } catch {
    onComplete({ ok: false, error: "Could not connect to server." });
  }
}

/**
 * Import a PDF from a local file pick.
 * Sends the file binary to the server for Gemini processing.
 */
export async function importPdfFile(
  file: { uri: string; name: string; file?: File },
  opts: {
    token: string | null;
    language?: string;
    onComplete: (outcome: ImportOutcome) => void;
    onBatchComplete?: (recipes: ScrapedRecipe[]) => void;
  }
): Promise<void> {
  const { token, language, onComplete, onBatchComplete } = opts;
  const currentToken = Platform.OS === "web" ? localStorage.getItem("auth_token") : token;
  const fileForForm: any = file.file ?? { uri: file.uri, name: file.name, type: "application/pdf" };
  try {
    const form = new FormData();
    form.append("file", fileForForm);
    if (language) form.append("language", language);
    const res = await fetch(`${API_URL}/api/import/pdf`, {
      method: "POST",
      headers: { Authorization: `Bearer ${currentToken}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) {
      onComplete({ ok: false, error: data.error ?? "PDF import failed." });
    } else if (Array.isArray(data.recipes) && data.recipes.length > 1 && onBatchComplete) {
      onBatchComplete(data.recipes);
    } else if (Array.isArray(data.recipes) && data.recipes.length > 0) {
      onComplete({
        ok: true,
        recipe: data.recipes[0],
        aiGenerated: data.generated,
      });
    } else {
      onComplete({ ok: false, error: "No recipes found in the PDF." });
    }
  } catch {
    onComplete({ ok: false, error: "Could not connect to server." });
  }
}
