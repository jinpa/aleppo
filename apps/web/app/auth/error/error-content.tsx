"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChefHat, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The sign-in link is no longer valid.",
  Default: "An error occurred during sign in.",
};

export function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";
  const message = errorMessages[error] ?? errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <h1 className="text-xl font-semibold text-stone-900">
            Sign in error
          </h1>
          <p className="text-sm text-stone-500">{message}</p>
        </div>
        <Button asChild className="w-full">
          <Link href="/auth/signin">Try again</Link>
        </Button>
      </div>
    </div>
  );
}
