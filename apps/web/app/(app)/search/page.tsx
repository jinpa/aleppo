"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/use-toast";

interface UserResult {
  id: string;
  name?: string | null;
  image?: string | null;
  bio?: string | null;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setResults(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleFollow = async (userId: string) => {
    const isFollowing = following.has(userId);
    setFollowing((prev) => {
      const next = new Set(prev);
      if (isFollowing) { next.delete(userId); } else { next.add(userId); }
      return next;
    });

    try {
      const res = await fetch("/api/follows", {
        method: isFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: userId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFollowing((prev) => {
          const next = new Set(prev);
          if (isFollowing) { next.add(userId); } else { next.delete(userId); }
          return next;
        });
        toast({
          title: "Failed to update follow",
          description: data?.error ?? `Server returned ${res.status}`,
          variant: "destructive",
        });
      }
    } catch {
      setFollowing((prev) => {
        const next = new Set(prev);
        if (isFollowing) { next.add(userId); } else { next.delete(userId); }
        return next;
      });
      toast({
        title: "Failed to update follow",
        description: "Network error — please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Find people</h1>
        <p className="text-stone-500 text-sm mt-0.5">
          Search for cooks to follow
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <Input
          placeholder="Search by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-stone-400" />
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((user) => {
            const initials = user.name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const isFollowing = following.has(user.id);

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-stone-200 hover:border-stone-300 transition-colors"
              >
                <Link href={`/u/${user.id}`} className="flex-1 flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={user.image ?? undefined} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900 truncate">
                      {user.name}
                    </p>
                    {user.bio && (
                      <p className="text-xs text-stone-500 truncate">{user.bio}</p>
                    )}
                  </div>
                </Link>
                <Button
                  size="sm"
                  variant={isFollowing ? "outline" : "default"}
                  onClick={() => handleFollow(user.id)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {query.length >= 2 && !loading && results.length === 0 && (
        <p className="text-center text-stone-500 text-sm py-8">
          No users found for &ldquo;{query}&rdquo;
        </p>
      )}
    </div>
  );
}
