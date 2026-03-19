import type { Recipe } from "@aleppo/shared";

type PendingModification = {
  original: Recipe & { author: { id: string; name: string | null; image: string | null } };
  modified: Record<string, unknown>;
  isOwner: boolean;
};

let pendingModification: PendingModification | null = null;

export function setPendingModification(data: PendingModification) {
  pendingModification = data;
}

export function getPendingModification(): PendingModification | null {
  return pendingModification;
}

export function clearPendingModification() {
  pendingModification = null;
}
