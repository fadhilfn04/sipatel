import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  user_email: string | null;
  message: string;
  created_at: string;
}

const QUERY_KEY = ['chat', 'messages'] as const;

async function fetchMessages(): Promise<ChatMessage[]> {
  const res = await fetch('/api/chat/messages?limit=60');
  if (!res.ok) throw new Error('Failed to fetch messages');
  const data = await res.json();
  return data.messages;
}

export function useChatMessages() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchMessages,
    refetchInterval: 3_000,
    staleTime: 1_000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useChatCurrentUser() {
  const { data: session } = useSession();
  return {
    id: session?.user?.id ?? null,
    name: session?.user?.name ?? 'Anonymous',
    avatar: session?.user?.avatar ?? null,
    email: session?.user?.email ?? null,
  };
}
