import { useState, useCallback, useRef, useEffect } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";

const POLL_INTERVAL = 30_000;

export function useUnreadNotifications() {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      }
    } catch {
      // silently ignore
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refetch();
      intervalRef.current = setInterval(refetch, POLL_INTERVAL);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [refetch])
  );

  return { unreadCount, refetch };
}
