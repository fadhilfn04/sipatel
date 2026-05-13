import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'dana_kematian' | 'dana_sosial' | 'keanggotaan' | 'system';
  event_type: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const QUERY_KEY = ['notifications'] as const;

async function fetchNotifications(params?: { unread?: boolean; limit?: number; category?: string }): Promise<NotificationsResponse> {
  const qs = new URLSearchParams();
  if (params?.unread) qs.set('unread', 'true');
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.category) qs.set('category', params.category);
  const res = await fetch(`/api/notifications${qs.toString() ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

// Main hook — list + unread count with auto-refresh
export function useNotifications(params?: { limit?: number; category?: string }) {
  return useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: () => fetchNotifications(params),
    refetchInterval: 30_000, // poll every 30 s
    staleTime: 15_000,
  });
}

// Lightweight hook — just the unread count (for the header badge)
export function useUnreadCount() {
  const { data } = useQuery({
    queryKey: [...QUERY_KEY, 'unread-count'],
    queryFn: () => fetchNotifications({ unread: true, limit: 100 }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  return data?.unreadCount ?? 0;
}

// Mark a single notification as read
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to mark as read');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// Mark all notifications as read
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all', { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to mark all as read');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// Delete a single notification
export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete notification');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
