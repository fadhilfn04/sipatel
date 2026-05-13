'use client';

import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, CheckCheck, FileText, PiggyBank, Heart,
  Users, Settings, Info, AlertTriangle, CheckCircle2,
  XCircle, Trash2, RefreshCw, BellOff, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useDeleteNotification,
  type Notification,
} from '@/lib/hooks/use-notifications';

// ── Relative time helper ──────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Icon resolver ─────────────────────────────────────────────────────────────
function NotifIcon({ notification }: { notification: Notification }) {
  const { category, type, event_type } = notification;

  const iconProps = 'h-4 w-4';

  if (event_type === 'dana_kematian_selesai')  return <CheckCircle2 className={cn(iconProps, 'text-green-600')} />;
  if (event_type === 'dana_kematian_ditolak')  return <XCircle className={cn(iconProps, 'text-red-600')} />;
  if (event_type === 'dokumen_verified')        return <CheckCircle2 className={cn(iconProps, 'text-blue-600')} />;
  if (event_type?.startsWith('dana_kematian')) return <PiggyBank className={cn(iconProps, 'text-rose-600')} />;
  if (category === 'dana_sosial')              return <Heart className={cn(iconProps, 'text-pink-600')} />;
  if (category === 'keanggotaan')              return <Users className={cn(iconProps, 'text-blue-600')} />;

  if (type === 'success') return <CheckCircle2 className={cn(iconProps, 'text-green-600')} />;
  if (type === 'warning') return <AlertTriangle className={cn(iconProps, 'text-yellow-600')} />;
  if (type === 'error')   return <XCircle className={cn(iconProps, 'text-red-600')} />;
  return <Info className={cn(iconProps, 'text-blue-600')} />;
}

const ICON_BG: Record<string, string> = {
  info:    'bg-blue-50 dark:bg-blue-950',
  success: 'bg-green-50 dark:bg-green-950',
  warning: 'bg-yellow-50 dark:bg-yellow-950',
  error:   'bg-red-50 dark:bg-red-950',
};

const CATEGORY_LABEL: Record<string, string> = {
  dana_kematian: 'Dana Kematian',
  dana_sosial:   'Dana Sosial',
  keanggotaan:   'Keanggotaan',
  system:        'Sistem',
};

const CATEGORY_BADGE_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  dana_kematian: 'info',
  dana_sosial:   'warning',
  keanggotaan:   'success',
  system:        'secondary',
};

// ── Single notification item ──────────────────────────────────────────────────
function NotifItem({
  notification,
  onMarkRead,
  onDelete,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (notif: Notification) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn(
        'relative flex gap-3 px-5 py-4 transition-colors cursor-pointer group',
        !notification.is_read && 'bg-primary/5 dark:bg-primary/10',
        'hover:bg-muted/60',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onNavigate(notification)}
    >
      {/* Unread dot */}
      {!notification.is_read && (
        <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary shrink-0" />
      )}

      {/* Icon */}
      <div className={cn(
        'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
        ICON_BG[notification.type] || ICON_BG.info,
      )}>
        <NotifIcon notification={notification} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !notification.is_read ? 'font-semibold' : 'font-medium')}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge
            variant={CATEGORY_BADGE_VARIANT[notification.category] || 'secondary'}
            appearance="ghost"
            className="text-[10px] px-1.5 py-0 h-4"
          >
            {CATEGORY_LABEL[notification.category] || notification.category}
          </Badge>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeAgo(notification.created_at)}
          </span>
        </div>
      </div>

      {/* Action buttons on hover */}
      {hovered && (
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {!notification.is_read && (
            <button
              title="Tandai sudah dibaca"
              onClick={() => onMarkRead(notification.id)}
              className="h-7 w-7 rounded-lg bg-background border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <button
            title="Hapus notifikasi"
            onClick={() => onDelete(notification.id)}
            className="h-7 w-7 rounded-lg bg-background border flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ unreadOnly }: { unreadOnly?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <BellOff className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-semibold text-foreground">
        {unreadOnly ? 'Semua sudah dibaca' : 'Belum ada notifikasi'}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {unreadOnly
          ? 'Tidak ada notifikasi yang belum dibaca saat ini.'
          : 'Notifikasi akan muncul di sini ketika ada aktivitas.'}
      </p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function NotifSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 px-5 py-4 animate-pulse">
          <div className="h-9 w-9 rounded-xl bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function NotificationsSheet({ trigger }: { trigger: ReactNode }) {
  const router = useRouter();
  const [tab, setTab] = useState<'all' | 'unread' | 'dana_kematian'>('all');

  const { data, isLoading, refetch, isFetching } = useNotifications({ limit: 60 });
  const markRead   = useMarkRead();
  const markAllRead = useMarkAllRead();
  const deleteNotif = useDeleteNotification();

  const notifications = data?.notifications || [];
  const unreadCount   = data?.unreadCount || 0;

  const filtered = {
    all:          notifications,
    unread:       notifications.filter((n) => !n.is_read),
    dana_kematian: notifications.filter((n) => n.category === 'dana_kematian'),
  };

  function handleNavigate(notif: Notification) {
    if (!notif.is_read) markRead.mutate(notif.id);
    if (notif.link) router.push(notif.link);
  }

  function handleMarkRead(id: string) {
    markRead.mutate(id);
  }

  function handleDelete(id: string) {
    deleteNotif.mutate(id);
  }

  function handleMarkAllRead() {
    markAllRead.mutate();
  }

  const listForTab = filtered[tab];

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="p-0 gap-0 sm:w-[480px] sm:max-w-none inset-5 start-auto h-auto rounded-lg [&_[data-slot=sheet-close]]:top-4.5 [&_[data-slot=sheet-close]]:end-5">

        {/* Header */}
        <SheetHeader className="mb-0 border-b">
          <div className="flex items-center justify-between p-4 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <SheetTitle className="text-base font-semibold">Notifikasi</SheetTitle>
              {unreadCount > 0 && (
                <span className="h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            {/* <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Perbarui"
              className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', isFetching && 'animate-spin')} />
            </button> */}
          </div>
        </SheetHeader>

        {/* Body */}
        <SheetBody className="p-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList variant="line" className="w-full px-4 mb-0">
              <TabsTrigger value="all" className="relative">
                Semua
                {notifications.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    ({notifications.length})
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread" className="relative">
                Belum Dibaca
                {unreadCount > 0 && (
                  <span className="ml-1.5 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="dana_kematian" className="relative">
                Dana Kematian
                {filtered.dana_kematian.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    ({filtered.dana_kematian.length})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(100vh-14rem)]">
              {isLoading ? (
                <NotifSkeleton />
              ) : listForTab.length === 0 ? (
                <EmptyState unreadOnly={tab === 'unread'} />
              ) : (
                <div className="divide-y divide-border">
                  {listForTab.map((notif) => (
                    <NotifItem
                      key={notif.id}
                      notification={notif}
                      onMarkRead={handleMarkRead}
                      onDelete={handleDelete}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </Tabs>
        </SheetBody>

        {/* Footer */}
        <SheetFooter className="border-t p-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            Tandai Semua Dibaca
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => router.push('/pelayanan/dana-kematian')}
          >
            <FileText className="h-4 w-4" />
            Lihat Dana Kematian
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
