"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChefHat, Loader2, ArrowLeft } from "lucide-react";

const schema = z.object({
  email: z.string().email("Please enter a valid email"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Reset password</h1>
          <p className="mt-2 text-sm text-stone-500">
            Enter your email to receive reset instructions
          </p>
        </div>

        {submitted ? (
          <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center space-y-2">
            <p className="text-sm font-medium text-green-800">
              Check your email
            </p>
            <p className="text-sm text-green-700">
              If that address is in our system, you&apos;ll receive reset
              instructions shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Send reset link
            </Button>
          </form>
        )}

        <div className="text-center">
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
