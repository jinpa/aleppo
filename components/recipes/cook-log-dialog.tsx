"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/use-toast";

interface CookLogDialogProps {
  recipeId: string;
  recipeTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: (log: {
    id: string;
    cookedOn: string;
    notes?: string | null;
    createdAt: Date;
  }) => void;
  inQueue?: boolean;
  onRemovedFromQueue?: () => void;
}

export function CookLogDialog({
  recipeId,
  recipeTitle,
  open,
  onOpenChange,
  onLogged,
  inQueue,
  onRemovedFromQueue,
}: CookLogDialogProps) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/cook-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeId,
        cookedOn: date,
        notes: notes.trim() || undefined,
      }),
    });

    if (!res.ok) {
      setLoading(false);
      toast({ title: "Failed to log cook", variant: "destructive" });
      return;
    }

    const log = await res.json();

    // Offer to remove from queue if applicable
    if (inQueue && onRemovedFromQueue) {
      await fetch("/api/queue", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId }),
      });
      onRemovedFromQueue();
    }

    onLogged(log);
    setNotes("");
    setDate(today);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a cook</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-stone-500">
            Recording a cook for <strong>{recipeTitle}</strong>
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="cook-date">Date cooked</Label>
            <Input
              id="cook-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cook-notes">
              How did it go?{" "}
              <span className="text-stone-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="cook-notes"
              placeholder="Any changes, notes, or thoughts..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-stone-400 text-right">
              {notes.length}/500
            </p>
          </div>

          {inQueue && (
            <p className="text-xs text-stone-500 bg-amber-50 rounded-lg p-2.5">
              This recipe is in your queue — it will be removed when you log this
              cook.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save cook
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
