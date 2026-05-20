'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Command,
  CommandCheck,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bell, BellOff, ChevronDown, X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Known event types for suggestions
const KNOWN_EVENT_TYPES = [
  { value: 'dana_kematian_created', label: 'Dana Kematian - Pengajuan Baru' },
  { value: 'dana_kematian_updated', label: 'Dana Kematian - Data Diperbarui' },
  { value: 'dana_kematian_verifikasi_cabang', label: 'Dana Kematian - Verifikasi Cabang' },
  { value: 'dana_kematian_proses_pusat', label: 'Dana Kematian - Proses Pusat' },
  { value: 'dana_kematian_verified', label: 'Dana Kematian - Disetujui PP' },
  { value: 'dana_kematian_penyaluran', label: 'Dana Kematian - Penyaluran' },
  { value: 'dana_kematian_selesai', label: 'Dana Kematian - Selesai' },
  { value: 'dana_kematian_ditolak', label: 'Dana Kematian - Ditolak' },
  { value: 'dana_kematian_deleted', label: 'Dana Kematian - Dihapus' },
  { value: 'dokumen_verified', label: 'Dokumen - Terverifikasi' },
  { value: 'dokumen_uploaded', label: 'Dokumen - Diunggah' },
  { value: 'dana_sosial_created', label: 'Dana Sosial - Pengajuan Baru' },
  { value: 'dana_sosial_disetujui', label: 'Dana Sosial - Disetujui' },
  { value: 'dana_sosial_ditolak', label: 'Dana Sosial - Ditolak' },
  { value: 'dana_sosial_disalurkan', label: 'Dana Sosial - Disalurkan' },
  { value: 'anggota_baru', label: 'Anggota - Anggota Baru' },
  { value: 'anggota_meninggal', label: 'Anggota - Anggota Meninggal' },
  { value: 'system_info', label: 'System - Info' },
];

interface RoutingRule {
  id: string;
  event_type: string;
  event_label: string;
  description: string | null;
  target_role_slugs: string[];
  is_enabled: boolean;
}

interface UserRole {
  id: string;
  slug: string;
  name: string;
}

interface NewRuleForm {
  event_type: string;
  event_label: string;
  description: string;
  target_role_slugs: string[];
  is_enabled: boolean;
}

async function fetchRouting(): Promise<RoutingRule[]> {
  const res = await apiFetch('/api/notification-routing');
  if (!res.ok) throw new Error('Gagal memuat pengaturan notifikasi');
  const json = await res.json();
  return json.data;
}

async function fetchRoles(): Promise<UserRole[]> {
  const res = await apiFetch('/api/user-management/roles/select');
  if (!res.ok) throw new Error('Gagal memuat daftar role');
  const json = await res.json();
  return json.data ?? json;
}

const EMPTY_FORM: NewRuleForm = {
  event_type: '',
  event_label: '',
  description: '',
  target_role_slugs: [],
  is_enabled: true,
};

export default function NotificationRoutingSettings() {
  const qc = useQueryClient();

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['notification-routing'],
    queryFn: fetchRouting,
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles-select'],
    queryFn: fetchRoles,
  });

  // Local draft state — edits buffered until Save
  const [draft, setDraft] = useState<Record<string, RoutingRule>>({});
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newForm, setNewForm] = useState<NewRuleForm>(EMPTY_FORM);
  const [newPopoverOpen, setNewPopoverOpen] = useState(false);
  const [eventTypeSearch, setEventTypeSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<RoutingRule | null>(null);

  const effectiveRule = (rule: RoutingRule): RoutingRule =>
    draft[rule.event_type] ?? rule;

  const updateDraft = (eventType: string, patch: Partial<RoutingRule>) => {
    setDraft((prev) => {
      const base = prev[eventType] ?? rules.find((r) => r.event_type === eventType)!;
      return { ...prev, [eventType]: { ...base, ...patch } };
    });
  };

  const isDirty = Object.keys(draft).length > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const changes = Object.values(draft).map((r) => ({
        event_type: r.event_type,
        target_role_slugs: r.target_role_slugs,
        is_enabled: r.is_enabled,
      }));
      const res = await apiFetch('/api/notification-routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: changes }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan perubahan');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-routing'] });
      setDraft({});
      toast.success('Pengaturan notifikasi berhasil disimpan');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (form: NewRuleForm) => {
      const res = await apiFetch('/api/notification-routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menambah event');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-routing'] });
      setAddOpen(false);
      setNewForm(EMPTY_FORM);
      setEventTypeSearch('');
      toast.success('Event notifikasi berhasil ditambahkan');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventType: string) => {
      const res = await apiFetch(`/api/notification-routing?event_type=${encodeURIComponent(eventType)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Gagal menghapus event');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-routing'] });
      setDeleteTarget(null);
      toast.success('Event notifikasi berhasil dihapus');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const toggleRole = (eventType: string, roleSlug: string, current: string[]) => {
    const next = current.includes(roleSlug)
      ? current.filter((s) => s !== roleSlug)
      : [...current, roleSlug];
    updateDraft(eventType, { target_role_slugs: next });
  };

  const toggleNewRole = (roleSlug: string) => {
    setNewForm((prev) => ({
      ...prev,
      target_role_slugs: prev.target_role_slugs.includes(roleSlug)
        ? prev.target_role_slugs.filter((s) => s !== roleSlug)
        : [...prev.target_role_slugs, roleSlug],
    }));
  };

  const handleSelectSuggestion = (value: string, label: string) => {
    setNewForm((prev) => ({ ...prev, event_type: value, event_label: prev.event_label || label }));
    setEventTypeSearch(value);
  };

  const filteredSuggestions = KNOWN_EVENT_TYPES.filter(
    (e) =>
      !rules.some((r) => r.event_type === e.value) &&
      (e.value.includes(eventTypeSearch.toLowerCase()) || e.label.toLowerCase().includes(eventTypeSearch.toLowerCase()))
  );

  if (rulesLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Tentukan role mana yang menerima notifikasi untuk setiap event alur kerja.
            Role <span className="font-medium">admin / administrator / owner</span> selalu menerima semua notifikasi.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Tambah Event
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan Perubahan
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => {
          const current = effectiveRule(rule);
          const isChanged = !!draft[rule.event_type];

          return (
            <Card key={rule.event_type} className={cn('transition-colors', isChanged && 'border-primary/50 bg-primary/5')}>
              <CardHeader className="pb-3 pt-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{rule.event_label}</span>
                      <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {rule.event_type}
                      </code>
                      {isChanged && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Belum disimpan
                        </Badge>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {current.is_enabled ? (
                      <Bell className="h-4 w-4 text-primary" />
                    ) : (
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={current.is_enabled}
                      onCheckedChange={(v) => updateDraft(rule.event_type, { is_enabled: v })}
                    />
                    <button
                      onClick={() => setDeleteTarget(rule)}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                      title="Hapus event ini"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-5 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground shrink-0">Kirim ke:</span>

                  {current.target_role_slugs.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      (tidak ada — notifikasi tidak dikirim ke siapapun)
                    </span>
                  ) : (
                    current.target_role_slugs.map((slug) => {
                      const role = roles.find((r) => r.slug === slug);
                      return (
                        <Badge key={slug} variant="secondary" className="gap-1 text-xs">
                          {role?.name ?? slug}
                          <button
                            onClick={() => toggleRole(rule.event_type, slug, current.target_role_slugs)}
                            className="ml-0.5 hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })
                  )}

                  <Popover
                    open={openPopover === rule.event_type}
                    onOpenChange={(o) => setOpenPopover(o ? rule.event_type : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
                        Tambah Role <ChevronDown className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari role..." />
                        <CommandList>
                          <CommandEmpty>Role tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-48">
                              {roles.map((role) => {
                                const selected = current.target_role_slugs.includes(role.slug);
                                return (
                                  <CommandItem
                                    key={role.id}
                                    onSelect={() => {
                                      toggleRole(rule.event_type, role.slug, current.target_role_slugs);
                                    }}
                                  >
                                    <span className="grow text-sm">{role.name}</span>
                                    <CommandCheck className={cn(selected ? 'opacity-100' : 'opacity-0')} />
                                  </CommandItem>
                                );
                              })}
                            </ScrollArea>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {rules.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Belum ada aturan notifikasi. Klik "Tambah Event" untuk memulai.
          </div>
        )}
      </div>

      {/* ── Add Event Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setNewForm(EMPTY_FORM); setEventTypeSearch(''); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Event Notifikasi</DialogTitle>
            <DialogDescription>
              Tambahkan aturan pengiriman notifikasi untuk event baru.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Event Type */}
            <div className="space-y-1.5">
              <Label htmlFor="event_type">
                Event Type <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="event_type"
                  placeholder="contoh: dana_kematian_created"
                  value={eventTypeSearch}
                  autoComplete="off"
                  onChange={(e) => {
                    setEventTypeSearch(e.target.value);
                    setNewForm((prev) => ({ ...prev, event_type: e.target.value }));
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="font-mono text-sm"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md overflow-hidden">
                    <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground font-medium">Saran event type</p>
                    <div className="max-h-44 overflow-y-auto pb-1">
                      {filteredSuggestions.slice(0, 6).map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          className="w-full text-left px-3 py-1.5 hover:bg-accent flex flex-col gap-0.5"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            handleSelectSuggestion(s.value, s.label);
                            setShowSuggestions(false);
                          }}
                        >
                          <span className="font-mono text-xs">{s.value}</span>
                          <span className="text-xs text-muted-foreground">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Harus cocok dengan event_type yang dikirim oleh server (snake_case).
              </p>
            </div>

            {/* Event Label */}
            <div className="space-y-1.5">
              <Label htmlFor="event_label">
                Label Event <span className="text-destructive">*</span>
              </Label>
              <Input
                id="event_label"
                placeholder="contoh: Pengajuan Dana Kematian Baru"
                value={newForm.event_label}
                onChange={(e) => setNewForm((prev) => ({ ...prev, event_label: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                placeholder="Opsional — kapan notifikasi ini dikirim?"
                rows={2}
                value={newForm.description}
                onChange={(e) => setNewForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Target Roles */}
            <div className="space-y-1.5">
              <Label>Kirim ke Role</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {newForm.target_role_slugs.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Belum ada role dipilih</span>
                ) : (
                  newForm.target_role_slugs.map((slug) => {
                    const role = roles.find((r) => r.slug === slug);
                    return (
                      <Badge key={slug} variant="secondary" className="gap-1 text-xs">
                        {role?.name ?? slug}
                        <button onClick={() => toggleNewRole(slug)} className="ml-0.5 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })
                )}
                <Popover open={newPopoverOpen} onOpenChange={setNewPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
                      Tambah Role <ChevronDown className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Cari role..." />
                      <CommandList>
                        <CommandEmpty>Role tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-48">
                            {roles.map((role) => {
                              const selected = newForm.target_role_slugs.includes(role.slug);
                              return (
                                <CommandItem key={role.id} onSelect={() => toggleNewRole(role.slug)}>
                                  <span className="grow text-sm">{role.name}</span>
                                  <CommandCheck className={cn(selected ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                              );
                            })}
                          </ScrollArea>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground">
                Biarkan kosong untuk mengirim ke semua role (broadcast).
              </p>
            </div>

            {/* Is Enabled */}
            <div className="flex items-center gap-3">
              <Switch
                checked={newForm.is_enabled}
                onCheckedChange={(v) => setNewForm((prev) => ({ ...prev, is_enabled: v }))}
              />
              <Label className="cursor-pointer">Aktifkan notifikasi ini</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={!newForm.event_type.trim() || !newForm.event_label.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(newForm)}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Tambah Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ──────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Event Notifikasi?</AlertDialogTitle>
            <AlertDialogDescription>
              Event <span className="font-mono font-medium">{deleteTarget?.event_type}</span> ({deleteTarget?.event_label}) akan dihapus secara permanen.
              Notifikasi yang sudah terkirim tidak akan terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.event_type)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
