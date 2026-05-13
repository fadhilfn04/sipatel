'use client';

import { ReactNode, useEffect, useRef, useState, KeyboardEvent } from 'react';
import { CheckCheck, MessageCircleMore, RefreshCw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useChatMessages,
  useSendMessage,
  useChatCurrentUser,
  type ChatMessage,
} from '@/lib/hooks/use-chat';

// ── Time helpers ──────────────────────────────────────────────────────────────
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// ── Avatar with initials fallback ─────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
];

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function UserAvatar({ userId, name, avatar, size = 'sm' }: {
  userId: string;
  name: string;
  avatar: string | null;
  size?: 'sm' | 'md';
}) {
  const cls = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm';

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={cn(cls, 'rounded-full object-cover shrink-0')}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div className={cn(cls, 'rounded-full flex items-center justify-center text-white font-semibold shrink-0', getAvatarColor(userId))}>
      {getInitials(name)}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn, showSender }: {
  msg: ChatMessage;
  isOwn: boolean;
  showSender: boolean;
}) {
  if (isOwn) {
    return (
      <div className="flex items-end justify-end gap-2 px-4">
        <div className="flex flex-col items-end gap-0.5 max-w-[75%]">
          <div className="bg-primary text-primary-foreground text-sm px-3.5 py-2.5 rounded-2xl rounded-br-sm shadow-sm wrap-break-word">
            {msg.message}
          </div>
          <div className="flex items-center gap-1 px-1">
            <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
            <CheckCheck className="h-3 w-3 text-primary" />
          </div>
        </div>
        <UserAvatar userId={msg.user_id} name={msg.user_name} avatar={msg.user_avatar} />
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 px-4">
      <UserAvatar userId={msg.user_id} name={msg.user_name} avatar={msg.user_avatar} />
      <div className="flex flex-col gap-0.5 max-w-[75%]">
        {showSender && (
          <span className="text-[11px] font-semibold text-muted-foreground px-1">
            {msg.user_name}
          </span>
        )}
        <div className="bg-muted text-foreground text-sm px-3.5 py-2.5 rounded-2xl rounded-bl-sm shadow-sm wrap-break-word">
          {msg.message}
        </div>
        <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.created_at)}</span>
      </div>
    </div>
  );
}

// ── Date separator ────────────────────────────────────────────────────────────
function DateSeparator({ date }: { date: string }) {
  const label = (() => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Hari ini';
    if (d.toDateString() === yesterday.toDateString()) return 'Kemarin';
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  })();

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground font-medium bg-background px-2 rounded-full border">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function ChatSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className={cn('flex items-end gap-2 animate-pulse', i % 2 === 0 && 'flex-row-reverse')}>
          <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
          <div className={cn('space-y-1', i % 2 === 0 && 'items-end flex flex-col')}>
            <div className="h-9 bg-muted rounded-2xl" style={{ width: `${120 + i * 40}px` }} />
            <div className="h-2.5 bg-muted rounded w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-8 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <MessageCircleMore className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-semibold">Belum ada pesan</p>
      <p className="text-sm text-muted-foreground mt-1">
        Jadilah yang pertama memulai percakapan!
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ChatSheet({ trigger }: { trigger: ReactNode }) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], isLoading, refetch, isFetching } = useChatMessages();
  const send = useSendMessage();
  const me = useChatCurrentUser();

  // Scroll to bottom when messages arrive or sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, open]);

  // Focus input when sheet opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  function handleSend() {
    const text = input.trim();
    if (!text || send.isPending) return;
    setInput('');
    send.mutate(text);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Compute unique active users from messages (last 24 h)
  const activeUsers = new Set(
    messages
      .filter((m) => Date.now() - new Date(m.created_at).getTime() < 86_400_000)
      .map((m) => m.user_id),
  ).size;

  // Group messages — insert date separators and decide when to show sender name
  type RenderedItem =
    | { kind: 'date'; date: string; key: string }
    | { kind: 'msg'; msg: ChatMessage; isOwn: boolean; showSender: boolean };

  const items: RenderedItem[] = [];
  let lastDate = '';
  let lastSenderId = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const dateKey = new Date(msg.created_at).toDateString();

    if (dateKey !== lastDate) {
      items.push({ kind: 'date', date: msg.created_at, key: `date-${dateKey}` });
      lastDate = dateKey;
      lastSenderId = '';
    }

    const isOwn = msg.user_id === me.id;
    const showSender = !isOwn && msg.user_id !== lastSenderId;
    items.push({ kind: 'msg', msg, isOwn, showSender });
    lastSenderId = msg.user_id;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="p-0 gap-0 sm:w-110 sm:max-w-none inset-5 start-auto h-auto rounded-lg **:data-[slot=sheet-close]:top-4.5 **:data-[slot=sheet-close]:inset-e-5 flex flex-col">

        {/* Header */}
        <SheetHeader className="mb-0 border-b shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageCircleMore className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold leading-tight">Internal Chat</SheetTitle>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {activeUsers > 0 ? `${activeUsers} aktif hari ini` : 'Grup semua pengguna'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {activeUsers > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] text-green-700 dark:text-green-400 font-medium">
                    {activeUsers} online
                  </span>
                </div>
              )}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                title="Perbarui"
                className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', isFetching && 'animate-spin')} />
              </button>
            </div>
          </div>
        </SheetHeader>

        {/* Messages */}
        <SheetBody className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-14rem)]">
            <div className="py-3 space-y-3">
              {isLoading ? (
                <ChatSkeleton />
              ) : items.length === 0 ? (
                <EmptyChat />
              ) : (
                items.map((item) =>
                  item.kind === 'date' ? (
                    <DateSeparator key={item.key} date={item.date} />
                  ) : (
                    <MessageBubble
                      key={item.msg.id}
                      msg={item.msg}
                      isOwn={item.isOwn}
                      showSender={item.showSender}
                    />
                  ),
                )
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </SheetBody>

        {/* Input */}
        <SheetFooter className="border-t p-3 shrink-0 block sm:space-x-0">
          {/* Sender info */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <UserAvatar userId={me.id ?? 'anon'} name={me.name} avatar={me.avatar} size="sm" />
            <span className="text-xs text-muted-foreground font-medium">{me.name}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 ml-auto" />
          </div>
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tulis pesan... (Enter untuk kirim)"
              className="flex-1 h-10 text-sm"
              disabled={send.isPending || !me.id}
              maxLength={1000}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!input.trim() || send.isPending || !me.id}
              className="h-10 px-3 gap-1.5"
            >
              <Send className="h-4 w-4" />
              {send.isPending ? '...' : 'Kirim'}
            </Button>
          </div>
          {!me.id && (
            <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
              Login untuk dapat mengirim pesan
            </p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
