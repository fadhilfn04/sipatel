'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  FileText,
  Loader2,
  LogOut,
  Send,
  ShieldCheck,
  ThumbsDown,
  Upload,
  UserCircle,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Toolbar, ToolbarHeading } from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAnggotaList } from '@/lib/hooks/use-anggota-api';
import {
  useCancelPengakhiranKeanggotaan,
  useCreatePengakhiranKeanggotaan,
  usePengakhiranKeanggotaanList,
  useUpdatePengakhiranKeanggotaanStatus,
} from '@/lib/hooks/use-pengakhiran-keanggotaan-api';
import { useHasAnyPermission } from '@/lib/hooks/use-rbac';
import { PENGAKHIRAN_MANAGE_PERMISSIONS } from '@/lib/rbac';
import {
  ALASAN_PENGAKHIRAN_OPTIONS,
  getPengakhiranFieldError,
  validatePengakhiranInput,
  type PengakhiranValidationError,
} from '@/lib/utils/pengakhiran-keanggotaan-validation';
import {
  PENGAKHIRAN_STATUS_FILTER_OPTIONS,
  getPengakhiranStatusProps,
  isPengakhiranCancelable,
} from '@/lib/workflow/pengakhiran-keanggotaan-status';
import type {
  Anggota,
  PengakhiranKeanggotaanWithAnggota,
  PengakhiranStatus,
} from '@/lib/supabase';

const INITIAL_FORM = {
  anggota_id: '',
  alasan: '',
  keterangan_alasan: '',
  tanggal_efektif_berhenti: '',
  nomor_dokumen: '',
  tanggal_dokumen: '',
  keterangan: '',
  file_dokumen_pendukung: '',
};

const ALASAN_LABELS: Record<string, string> = {
  mengundurkan_diri: 'Mengundurkan Diri',
  diberhentikan: 'Diberhentikan',
  lainnya: 'Lainnya',
};

export default function PengakhiranKeanggotaanPage() {
  const canManage = useHasAnyPermission(PENGAKHIRAN_MANAGE_PERMISSIONS);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<PengakhiranValidationError[]>([]);
  const [selectedAnggota, setSelectedAnggota] = useState<Anggota | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Member picker (debounced)
  const [nikSearch, setNikSearch] = useState('');
  const [debouncedNik, setDebouncedNik] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  // List filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [debouncedListSearch, setDebouncedListSearch] = useState('');

  // Decision dialog
  const [decision, setDecision] = useState<{
    row: PengakhiranKeanggotaanWithAnggota;
    status: PengakhiranStatus;
    title: string;
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedNik(nikSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [nikSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedListSearch(listSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [listSearch]);

  const { data: anggotaData, isLoading: anggotaLoading } = useAnggotaList({
    search: debouncedNik,
    page: 1,
    limit: 20,
  });
  const { data: listData, isLoading: listLoading } = usePengakhiranKeanggotaanList({
    status: statusFilter,
    search: debouncedListSearch,
    page: 1,
    limit: 50,
  });

  const createMutation = useCreatePengakhiranKeanggotaan();
  const updateStatusMutation = useUpdatePengakhiranKeanggotaanStatus();
  const cancelMutation = useCancelPengakhiranKeanggotaan();

  const submissions: PengakhiranKeanggotaanWithAnggota[] = listData?.data || [];
  const anggotaResults: Anggota[] = useMemo(
    () =>
      (anggotaData?.data || []).filter(
        (a) => a.status_anggota !== 'meninggal' && a.status_keanggotaan !== 'berhenti',
      ),
    [anggotaData],
  );

  const formDisabled = createMutation.isPending || uploading;

  const setField = (field: keyof typeof INITIAL_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => prev.filter((e) => e.field !== (field as any)));
  };

  const handleSelectAnggota = (anggota: Anggota) => {
    setSelectedAnggota(anggota);
    setForm((prev) => ({ ...prev, anggota_id: anggota.id }));
    setErrors((prev) => prev.filter((e) => e.field !== 'anggota_id'));
    setPickerOpen(false);
  };

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'anggota');
      fd.append('folder', 'surat-pengakhiran');

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Upload gagal');

      if (form.file_dokumen_pendukung) {
        await fetch(
          `/api/upload?url=${encodeURIComponent(form.file_dokumen_pendukung)}&bucket=anggota`,
          { method: 'DELETE' },
        ).catch(() => undefined);
      }

      setForm((prev) => ({ ...prev, file_dokumen_pendukung: json.url }));
      toast.success('Dokumen pendukung berhasil diunggah');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload gagal');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = async () => {
    if (!form.file_dokumen_pendukung) return;
    try {
      await fetch(
        `/api/upload?url=${encodeURIComponent(form.file_dokumen_pendukung)}&bucket=anggota`,
        { method: 'DELETE' },
      );
      setForm((prev) => ({ ...prev, file_dokumen_pendukung: '' }));
    } catch {
      toast.error('Gagal menghapus dokumen');
    }
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setSelectedAnggota(null);
    setErrors([]);
    setUploadError(null);
    setNikSearch('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validatePengakhiranInput({
      anggota_id: form.anggota_id,
      alasan: form.alasan,
      keterangan_alasan: form.keterangan_alasan,
      tanggal_efektif_berhenti: form.tanggal_efektif_berhenti,
      nomor_dokumen: form.nomor_dokumen,
      tanggal_dokumen: form.tanggal_dokumen,
    });
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      toast.error('Periksa kembali data pengajuan', {
        description: validationErrors[0].message,
      });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        anggota_id: form.anggota_id,
        alasan: form.alasan as any,
        keterangan_alasan: form.keterangan_alasan || null,
        tanggal_efektif_berhenti: form.tanggal_efektif_berhenti,
        nomor_dokumen: form.nomor_dokumen,
        tanggal_dokumen: form.tanggal_dokumen,
        keterangan: form.keterangan || null,
        file_dokumen_pendukung: form.file_dokumen_pendukung || null,
      });
      toast.success('Pengajuan pengakhiran keanggotaan berhasil dikirim', {
        description:
          result.message || 'Pengajuan akan diproses melalui verifikasi PC dan persetujuan PP.',
      });
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengirim pengajuan';
      toast.error('Pengajuan gagal dikirim', { description: message });
    }
  };

  const openDecision = (
    row: PengakhiranKeanggotaanWithAnggota,
    status: PengakhiranStatus,
    title: string,
  ) => {
    setDecision({ row, status, title });
    setDecisionNote('');
  };

  const handleDecision = async () => {
    if (!decision) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: decision.row.id,
        status: decision.status,
        catatan: decisionNote || undefined,
      });
      toast.success(`Status pengajuan berhasil diubah ke "${decision.title}"`);
      setDecision(null);
      setDecisionNote('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memperbarui status';
      toast.error('Gagal memperbarui status', { description: message });
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Pengajuan pengakhiran keanggotaan berhasil dibatalkan');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membatalkan pengajuan';
      toast.error('Pembatalan gagal', { description: message });
    }
  };

  const formatDateOnly = (value: string | null | undefined) => {
    if (!value) return '-';
    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Pengakhiran Keanggotaan"
            description="Ajukan pemberhentian anggota dengan dokumen resmi. Pengajuan diverifikasi PC dan diputuskan PP."
          />
        </Toolbar>
      </Container>

      {!canManage ? (
        <Container>
          <Alert variant="destructive">
            <AlertTitle>Akses ditolak</AlertTitle>
            <AlertDescription>
              Anda tidak memiliki akses ke menu Pengakhiran Keanggotaan. Fitur ini khusus
              pengurus/admin dengan hak kelola keanggotaan.
            </AlertDescription>
          </Alert>
        </Container>
      ) : (
        <Container>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="size-4" />
                Form Pengajuan Pengakhiran
              </CardTitle>
              <CardDescription>
                Pilih anggota, tentukan alasan berhenti, lalu lengkapi data dokumen. Field bertanda{' '}
                <span className="text-destructive">*</span> wajib diisi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

                <div className="space-y-2">
                  <Label htmlFor="nik-picker">
                    Anggota (NIK) <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="nik-picker"
                        variant="outline"
                        mode="input"
                        aria-expanded={pickerOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedAnggota ? (
                          <span className="flex items-center gap-2 truncate">
                            <span className="font-mono">{selectedAnggota.nik}</span>
                            <span className="text-muted-foreground truncate">
                              {selectedAnggota.nama_anggota}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Cari & pilih NIK anggota...</span>
                        )}
                        <ChevronsUpDown className="ms-auto size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popper-anchor-width) p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Ketik NIK atau nama anggota..."
                          value={nikSearch}
                          onValueChange={setNikSearch}
                        />
                        <CommandList>
                          {anggotaLoading ? (
                            <div className="space-y-2 p-4">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-4 w-1/2" />
                            </div>
                          ) : anggotaResults.length === 0 ? (
                            <CommandEmpty>Anggota aktif tidak ditemukan.</CommandEmpty>
                          ) : (
                            <CommandGroup>
                              {anggotaResults.map((anggota) => (
                                <CommandItem
                                  key={anggota.id}
                                  value={anggota.id}
                                  onSelect={() => handleSelectAnggota(anggota)}
                                >
                                  <span className="flex w-full items-center gap-2">
                                    <span className="font-mono text-xs">{anggota.nik}</span>
                                    <span className="truncate text-sm">{anggota.nama_anggota}</span>
                                    <span className="ms-auto truncate text-xs text-muted-foreground">
                                      {anggota.nama_cabang}
                                    </span>
                                    {selectedAnggota?.id === anggota.id && (
                                      <Check className="size-4 shrink-0" />
                                    )}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {getPengakhiranFieldError(errors, 'anggota_id') && (
                    <p className="text-xs text-destructive">
                      {getPengakhiranFieldError(errors, 'anggota_id')}
                    </p>
                  )}
                </div>

                {selectedAnggota && (
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <UserCircle className="size-4" />
                      Data Anggota Terpilih
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Nama Anggota</p>
                        <p className="text-sm font-medium">{selectedAnggota.nama_anggota}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">NIK</p>
                        <p className="font-mono text-sm">{selectedAnggota.nik}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cabang / PC</p>
                        <p className="text-sm font-medium">{selectedAnggota.nama_cabang || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Kategori / Status</p>
                        <p className="text-sm font-medium">
                          {selectedAnggota.kategori_anggota} / {selectedAnggota.status_anggota}
                        </p>
                      </div>
                    </div>
                  </div>
                )}


                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="alasan">
                      Alasan Berhenti <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.alasan || undefined}
                      onValueChange={(value) => {
                        setField('alasan', value);
                        if (value !== 'lainnya') setField('keterangan_alasan', '');
                      }}
                      disabled={formDisabled}
                    >
                      <SelectTrigger id="alasan" className="w-full">
                        <SelectValue placeholder="Pilih alasan berhenti" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALASAN_PENGAKHIRAN_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getPengakhiranFieldError(errors, 'alasan') && (
                      <p className="text-xs text-destructive">
                        {getPengakhiranFieldError(errors, 'alasan')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tanggal_efektif_berhenti">
                      Tanggal Efektif Berhenti <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="tanggal_efektif_berhenti"
                      type="date"
                      value={form.tanggal_efektif_berhenti}
                      onChange={(e) => setField('tanggal_efektif_berhenti', e.target.value)}
                      disabled={formDisabled}
                      max={new Date().toISOString().slice(0, 10)}
                      aria-invalid={!!getPengakhiranFieldError(errors, 'tanggal_efektif_berhenti')}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tanggal anggota resmi berhenti (tidak boleh di masa depan).
                    </p>
                    {getPengakhiranFieldError(errors, 'tanggal_efektif_berhenti') && (
                      <p className="text-xs text-destructive">
                        {getPengakhiranFieldError(errors, 'tanggal_efektif_berhenti')}
                      </p>
                    )}
                  </div>
                </div>

                {form.alasan === 'lainnya' && (
                  <div className="space-y-2">
                    <Label htmlFor="keterangan_alasan">
                      Keterangan Alasan <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="keterangan_alasan"
                      placeholder="Jelaskan alasan berhentinya anggota..."
                      value={form.keterangan_alasan}
                      onChange={(e) => setField('keterangan_alasan', e.target.value)}
                      disabled={formDisabled}
                      aria-invalid={!!getPengakhiranFieldError(errors, 'keterangan_alasan')}
                    />
                    {getPengakhiranFieldError(errors, 'keterangan_alasan') && (
                      <p className="text-xs text-destructive">
                        {getPengakhiranFieldError(errors, 'keterangan_alasan')}
                      </p>
                    )}
                  </div>
                )}


                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nomor_dokumen">
                      Nomor Dokumen <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="nomor_dokumen"
                      type="text"
                      placeholder="Contoh: 12/BERHENTI/P2TEL/II/2026"
                      value={form.nomor_dokumen}
                      onChange={(e) => setField('nomor_dokumen', e.target.value)}
                      disabled={formDisabled}
                      maxLength={100}
                      aria-invalid={!!getPengakhiranFieldError(errors, 'nomor_dokumen')}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nomor surat/dokumen resmi pengakhiran keanggotaan.
                    </p>
                    {getPengakhiranFieldError(errors, 'nomor_dokumen') && (
                      <p className="text-xs text-destructive">
                        {getPengakhiranFieldError(errors, 'nomor_dokumen')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tanggal_dokumen">
                      Tanggal Dokumen <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="tanggal_dokumen"
                      type="date"
                      value={form.tanggal_dokumen}
                      onChange={(e) => setField('tanggal_dokumen', e.target.value)}
                      disabled={formDisabled}
                      aria-invalid={!!getPengakhiranFieldError(errors, 'tanggal_dokumen')}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tanggal diterbitkannya dokumen (tidak melebihi tanggal efektif).
                    </p>
                    {getPengakhiranFieldError(errors, 'tanggal_dokumen') && (
                      <p className="text-xs text-destructive">
                        {getPengakhiranFieldError(errors, 'tanggal_dokumen')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keterangan">Keterangan</Label>
                  <Textarea
                    id="keterangan"
                    placeholder="Catatan tambahan (opsional)…"
                    value={form.keterangan}
                    onChange={(e) => setField('keterangan', e.target.value)}
                    disabled={formDisabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dokumen-pendukung">Dokumen Pendukung (opsional)</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={formDisabled}
                    >
                      {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                      {uploading ? 'Mengunggah...' : 'Pilih File'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      id="dokumen-pendukung"
                      type="file"
                      accept=".pdf,image/jpeg,image/png"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0])}
                      disabled={formDisabled}
                    />
                    {form.file_dokumen_pendukung && (
                      <div className="flex items-center gap-2 text-sm">
                        <a
                          href={form.file_dokumen_pendukung}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          Lihat dokumen
                        </a>
                        <Button
                          type="button"
                          mode="icon"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6"
                          onClick={handleRemoveFile}
                          disabled={formDisabled}
                          title="Hapus dokumen"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PDF/JPG/PNG, maksimal 5 MB. Dokumen pendukung tidak wajib.
                  </p>
                  {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                </div>

                <div className="flex items-center justify-end gap-2.5 border-t border-border pt-5">
                  <Button type="button" variant="outline" onClick={resetForm} disabled={formDisabled}>
                    Reset
                  </Button>
                  <Button type="submit" disabled={formDisabled}>
                    {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                    {createMutation.isPending ? 'Mengirim...' : 'Kirim Pengajuan'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </Container>
      )}


      {canManage && (
        <Container className="mt-5">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4" />
                  Riwayat Pengajuan Pengakhiran
                </CardTitle>
                <CardDescription>
                  Seluruh pengajuan pengakhiran keanggotaan beserta status verifikasinya.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Input
                  placeholder="Cari NIK / nama anggota..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full sm:w-64"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    {PENGAKHIRAN_STATUS_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {listLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <CalendarDays className="size-10 text-muted-foreground/50" />
                  <div>
                    <p className="text-sm font-medium">Belum ada pengajuan pengakhiran</p>
                    <p className="text-xs text-muted-foreground">
                      Pengajuan yang dikirim akan tampil di sini.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>

                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">DIAJUKAN</TableHead>
                        <TableHead className="text-xs">ANGGOTA</TableHead>
                        <TableHead className="text-xs">CABANG</TableHead>
                        <TableHead className="text-xs">ALASAN</TableHead>
                        <TableHead className="text-xs">TGL EFEKTIF</TableHead>
                        <TableHead className="text-xs">NO. DOKUMEN</TableHead>
                        <TableHead className="text-xs">STATUS</TableHead>
                        <TableHead className="text-xs text-right">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((row) => {
                        const statusProps = getPengakhiranStatusProps(row.status);
                        const cancelable = isPengakhiranCancelable(row.status);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs">{formatDateTime(row.created_at)}</TableCell>
                            <TableCell>
                              <div className="text-xs font-medium">{row.nama_anggota || '-'}</div>
                              <div className="font-mono text-xs text-muted-foreground">{row.nik}</div>
                            </TableCell>
                            <TableCell className="text-xs">{row.nama_cabang || '-'}</TableCell>
                            <TableCell className="text-xs">
                              {ALASAN_LABELS[row.alasan] || row.alasan}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatDateOnly(row.tanggal_efektif_berhenti)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{row.nomor_dokumen}</TableCell>
                            <TableCell>
                              <Badge variant={statusProps.variant} appearance="ghost">
                                {statusProps.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {row.status === 'menunggu' && (
                                  <Button
                                    mode="icon"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7"
                                    title="Verifikasi PC"
                                    disabled={updateStatusMutation.isPending}
                                    onClick={() =>
                                      openDecision(row, 'diverifikasi_pc', 'Verifikasi PC')
                                    }
                                  >
                                    <ShieldCheck className="size-3.5" />
                                  </Button>
                                )}
                                {row.status === 'diverifikasi_pc' && (
                                  <>
                                    <Button
                                      mode="icon"
                                      size="sm"
                                      className="h-7 w-7"
                                      title="Setujui (PP)"
                                      disabled={updateStatusMutation.isPending}
                                      onClick={() => openDecision(row, 'disetujui_pp', 'Disetujui PP')}
                                    >
                                      <Check className="size-3.5" />
                                    </Button>
                                    <Button
                                      mode="icon"
                                      variant="destructive"
                                      size="sm"
                                      className="h-7 w-7"
                                      title="Tolak"
                                      disabled={updateStatusMutation.isPending}
                                      onClick={() => openDecision(row, 'ditolak', 'Ditolak')}
                                    >
                                      <ThumbsDown className="size-3.5" />
                                    </Button>
                                  </>
                                )}
                                {cancelable && (
                                  <Button
                                    mode="icon"
                                    variant="destructive"
                                    size="sm"
                                    className="h-7 w-7"
                                    title="Batalkan pengajuan"
                                    disabled={cancelMutation.isPending}
                                    onClick={() => handleCancel(row.id)}
                                  >
                                    <XCircle className="size-3.5" />
                                  </Button>
                                )}
                                {row.status === 'disetujui_pp' && (
                                  <Badge variant="success" appearance="ghost" className="text-xs">
                                    Anggota Berhenti
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </Container>
      )}


      <Dialog open={!!decision} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{decision?.title}</DialogTitle>
            <DialogDescription>
              {decision?.status === 'disetujui_pp'
                ? 'Menyetujui pengakhiran akan mengubah status keanggotaan anggota menjadi "berhenti" dan tidak dapat dibatalkan otomatis.'
                : 'Beri catatan untuk keputusan ini (opsional).'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="decision-note">Catatan</Label>
              <Textarea
                id="decision-note"
                placeholder="Catatan verifikasi/keputusan (opsional)…"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={updateStatusMutation.isPending}>
              Batal
            </Button>
            <Button
              variant={decision?.status === 'ditolak' ? 'destructive' : 'primary'}
              onClick={handleDecision}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending && <Loader2 className="animate-spin" />}
              {decision?.status === 'ditolak' ? <ThumbsDown /> : <Check />}
              Simpan Keputusan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}

