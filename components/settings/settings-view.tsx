"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Globe, Lock, Camera, Tag, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/lib/use-toast";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  bio: z.string().max(500).optional(),
  isPublic: z.boolean(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;

interface SettingsViewProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    bio?: string | null;
    isPublic: boolean;
    defaultTagsEnabled: boolean;
    defaultRecipeIsPublic: boolean;
    hasPassword: boolean;
  };
}

export function SettingsView({ user }: SettingsViewProps) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(user.image ?? "");
  const [uploading, setUploading] = useState(false);
  const [defaultTagsEnabled, setDefaultTagsEnabled] = useState(user.defaultTagsEnabled);
  const [defaultRecipeIsPublic, setDefaultRecipeIsPublic] = useState(user.defaultRecipeIsPublic);
  const [savingDefaults, setSavingDefaults] = useState(false);

  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name ?? "",
      bio: user.bio ?? "",
      isPublic: user.isPublic,
    },
  });

  const passwordForm = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const isPublic = profileForm.watch("isPublic");

  const handleProfileSave = async (data: ProfileData) => {
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, image: avatarUrl || null }),
    });

    if (res.ok) {
      toast({ title: "Profile updated", variant: "success" });
      router.refresh();
    } else {
      const err = await res.json();
      toast({ title: err.error || "Failed to update profile", variant: "destructive" });
    }
  };

  const handlePasswordSave = async (data: PasswordData) => {
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    });

    if (res.ok) {
      toast({ title: "Password updated", variant: "success" });
      passwordForm.reset();
    } else {
      const err = await res.json();
      toast({ title: err.error || "Failed to update password", variant: "destructive" });
    }
  };

  const handleDefaultToggle = async (
    field: "defaultTagsEnabled" | "defaultRecipeIsPublic",
    value: boolean
  ) => {
    if (field === "defaultTagsEnabled") setDefaultTagsEnabled(value);
    else setDefaultRecipeIsPublic(value);

    setSavingDefaults(true);
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setSavingDefaults(false);

    if (res.ok) {
      toast({ title: "Default updated", variant: "success" });
    } else {
      toast({ title: "Failed to update default", variant: "destructive" });
      if (field === "defaultTagsEnabled") setDefaultTagsEnabled(!value);
      else setDefaultRecipeIsPublic(!value);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      setAvatarUrl(url);
      toast({ title: "Avatar uploaded", variant: "success" });
    } else {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-lg mx-auto space-y-10">
      <h1 className="text-2xl font-bold text-stone-900">Settings</h1>

      {/* Profile */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-stone-900 border-b border-stone-200 pb-3">
          Profile
        </h2>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-stone-900 text-white cursor-pointer hover:bg-stone-700 transition-colors shadow-sm">
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </label>
          </div>
          <div>
            <p className="font-medium text-stone-900">{user.name}</p>
            <p className="text-sm text-stone-500">{user.email}</p>
          </div>
        </div>

        <form
          onSubmit={profileForm.handleSubmit(handleProfileSave)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...profileForm.register("name")} />
            {profileForm.formState.errors.name && (
              <p className="text-xs text-red-600">
                {profileForm.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell people a bit about your cooking..."
              rows={3}
              maxLength={500}
              {...profileForm.register("bio")}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="h-5 w-5 text-stone-600" />
              ) : (
                <Lock className="h-5 w-5 text-stone-600" />
              )}
              <div>
                <p className="text-sm font-medium text-stone-900">
                  {isPublic ? "Public profile" : "Private profile"}
                </p>
                <p className="text-xs text-stone-500">
                  {isPublic
                    ? "Anyone can see your profile and public recipes"
                    : "Only you can see your profile"}
                </p>
              </div>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={(v) =>
                profileForm.setValue("isPublic", v)
              }
            />
          </div>

          <Button
            type="submit"
            disabled={profileForm.formState.isSubmitting}
          >
            {profileForm.formState.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Save profile
          </Button>
        </form>
      </section>

      <Separator />

      {/* Password */}
      {user.hasPassword && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-stone-900">
            Change password
          </h2>

          <form
            onSubmit={passwordForm.handleSubmit(handlePasswordSave)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                {...passwordForm.register("currentPassword")}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-red-600">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                {...passwordForm.register("newPassword")}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-red-600">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...passwordForm.register("confirmPassword")}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-red-600">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="outline"
              disabled={passwordForm.formState.isSubmitting}
            >
              {passwordForm.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Update password
            </Button>
          </form>
        </section>
      )}

      {!user.hasPassword && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-stone-900">
            Connected accounts
          </h2>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-stone-50 border border-stone-200">
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-stone-900">
                Google
              </p>
              <p className="text-xs text-stone-500">{user.email}</p>
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              Connected
            </span>
          </div>
        </section>
      )}

      <Separator />

      {/* Recipe defaults */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Recipe defaults</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            These apply when importing or creating new recipes. You can always change them per recipe.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
            <div className="flex items-center gap-3">
              <Tag className="h-5 w-5 text-stone-600" />
              <div>
                <p className="text-sm font-medium text-stone-900">Include imported tags</p>
                <p className="text-xs text-stone-500">
                  Pre-fill tags from the recipe source when importing
                </p>
              </div>
            </div>
            <Switch
              checked={defaultTagsEnabled}
              disabled={savingDefaults}
              onCheckedChange={(v) => handleDefaultToggle("defaultTagsEnabled", v)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-stone-600" />
              <div>
                <p className="text-sm font-medium text-stone-900">
                  {defaultRecipeIsPublic ? "New recipes start as public" : "New recipes start as private"}
                </p>
                <p className="text-xs text-stone-500">
                  {defaultRecipeIsPublic
                    ? "Visible to your followers and anyone with the link"
                    : "Only visible to you until you make them public"}
                </p>
              </div>
            </div>
            <Switch
              checked={defaultRecipeIsPublic}
              disabled={savingDefaults}
              onCheckedChange={(v) => handleDefaultToggle("defaultRecipeIsPublic", v)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
