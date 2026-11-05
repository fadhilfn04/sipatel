'use client';

import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowLeftRight,
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  FileText,
  Loader2,
  Send,
  UserCircle,
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
import { useAnggotaList } from '@/lib/hooks/use-anggota-api';
import {
  useCancelMutasiCabang,
  useCreateMutasiCabang,
  useMutasiCabangList,
  useMutasiCabangOptions,
} from '@/lib/hooks/use-mutasi-cabang-api';
import { useHasPermission } from '@/lib/hooks/use-rbac';
import { PERMISSIONS } from '@/lib/rbac';
import {
  getMutasiFieldError,
  validatePengajuanMutasiInput,
  type MutasiCabangValidationError,
} from '@/lib/utils/mutasi-cabang-validation';
import {
  getMutasiCabangStatusProps,
  isMutasiCabangActive,
  isMutasiCabangCancelable,
} from '@/lib/workflow/mutasi-cabang-status';
import type { Anggota, PengajuanMutasiCabang } from '@/lib/supabase';

const INITIAL_FORM = {
  anggota_id: '',
  cabang_tujuan: '',
  kode_cabang_tujuan: '',
  tanggal_mulai_mutasi: '',
  nomor_dokumen_mutasi: '',
  tanggal_dokumen_mutasi: '',
};

export default function MutasiCabangPage() {
  const canManage = useHasPermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<MutasiCabangValidationError[]>([]);
  const [selectedAnggota, setSelectedAnggota] = useState<Anggota | null>(null);

  // Pencarian NIK (debounced).
  const [nikSearch, setNikSearch] = useState('');
  const [debouncedNik, setDebouncedNik] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedNik(nikSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [nikSearch]);

  const { data: anggotaData, isLoading: anggotaLoading } = useAnggotaList({
    search: debouncedNik,
    page: 1,
    limit: 20,
  });
  const { data: cabangOptions, isLoading: cabangLoading } = useMutasiCabangOptions();
  const { data: listData, isLoading: listLoading } = useMutasiCabangList({
    page: 1,
    limit: 50,
  });
  const createMutation = useCreateMutasiCabang();
  const cancelMutation = useCancelMutasiCabang();

  const submissions: PengajuanMutasiCabang[] = listData?.data || [];
  const anggotaResults: Anggota[] = anggotaData?.data || [];

  const activeSubmission = useMemo(
    () =>
      submissions.find(
        (row) => row.anggota_id === form.anggota_id && isMutasiCabangActive(row.status),
      ) ?? null,
    [submissions, form.anggota_id],
  );

  const cabangOptionsForSelect = useMemo(() => {
    const asal = (selectedAnggota?.nama_cabang || '').trim().toUpperCase();
    return (cabangOptions || []).filter(
      (opt) => opt.nama_cabang.trim().toUpperCase() !== asal,
    );
  }, [cabangOptions, selectedAnggota]);

  const formDisabled = createMutation.isPending;

  const setField = (field: keyof typeof INITIAL_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => prev.filter((e) => e.field !== field));
  };

  const handleSelectAnggota = (anggota: Anggota) => {
    const asalUpper = (anggota.nama_cabang || '').trim().toUpperCase();
    setSelectedAnggota(anggota);
    setForm((prev) => ({
      ...prev,
      anggota_id: anggota.id,
      // Reset cabang tujuan bila sama dengan cabang asal anggota baru.
      cabang_tujuan: prev.cabang_tujuan.toUpperCase() === asalUpper ? '' : prev.cabang_tujuan,
      kode_cabang_tujuan:
        prev.cabang_tujuan.toUpperCase() === asalUpper ? '' : prev.kode_cabang_tujuan,
    }));
    setErrors((prev) => prev.filter((e) => e.field !== 'anggota_id'));
    setPickerOpen(false);
  };

  const handleCabangChange = (value: string) => {
    const option = (cabangOptions || []).find(
      (opt) => (opt.kode_cabang ?? opt.nama_cabang) === value,
    );
    setForm((prev) => ({
      ...prev,
      cabang_tujuan: option?.nama_cabang ?? value,
      kode_cabang_tujuan: option?.kode_cabang ?? '',
    }));
    setErrors((prev) => prev.filter((e) => e.field !== 'cabang_tujuan'));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validatePengajuanMutasiInput({
      anggota_id: form.anggota_id,
      cabang_tujuan: form.cabang_tujuan,
      cabang_asal: selectedAnggota?.nama_cabang,
      tanggal_mulai_mutasi: form.tanggal_mulai_mutasi,
      nomor_dokumen_mutasi: form.nomor_dokumen_mutasi,
      tanggal_dokumen_mutasi: form.tanggal_dokumen_mutasi,
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
        cabang_tujuan: form.cabang_tujuan,
        kode_cabang_tujuan: form.kode_cabang_tujuan || null,
        tanggal_mulai_mutasi: form.tanggal_mulai_mutasi,
        nomor_dokumen_mutasi: form.nomor_dokumen_mutasi,
        tanggal_dokumen_mutasi: form.tanggal_dokumen_mutasi,
      });
      toast.success('Pengajuan mutasi cabang berhasil dikirim', {
        description:
          result.message || 'Pengajuan akan diproses melalui verifikasi PC dan persetujuan PP.',
      });
      setForm(INITIAL_FORM);
      setSelectedAnggota(null);
      setErrors([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengirim pengajuan';
      toast.error('Pengajuan gagal dikirim', { description: message });
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Pengajuan mutasi cabang berhasil dibatalkan');
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
            title="Mutasi Cabang"
            description="Ajukan perpindahan anggota antar-cabang dengan dokumen mutasi resmi."
          />
        </Toolbar>
      </Container>

      {!canManage ? (
        <Container>
          <Alert variant="destructive">
            <AlertTitle>Akses ditolak</AlertTitle>
            <AlertDescription>
              Anda tidak memiliki akses ke menu Mutasi Cabang. Fitur ini khusus
              pengurus/admin dengan hak kelola keanggotaan.
            </AlertDescription>
          </Alert>
        </Container>
      ) : (
      <Container>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="size-4" />
              Form Pengajuan Mutasi
            </CardTitle>
            <CardDescription>
              Pilih anggota berdasarkan NIK, tentukan cabang tujuan, lalu lengkapi
              data dokumen mutasi. Seluruh field wajib diisi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeSubmission && (
              <Alert variant="warning" className="mb-5">
                <AlertTitle>Anggota masih memiliki pengajuan aktif</AlertTitle>
                <AlertDescription>
                  {activeSubmission.nama_anggota} ({activeSubmission.nik}) memiliki pengajuan
                  berstatus{' '}
                  <strong>{getMutasiCabangStatusProps(activeSubmission.status).label}</strong>{' '}
                  ke <strong>{activeSubmission.cabang_tujuan}</strong>. Batalkan pengajuan
                  tersebut sebelum membuat pengajuan baru untuk anggota ini.
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nik-picker">
                    NIK Anggota <span className="text-destructive">*</span>
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
                            <CommandEmpty>Anggota tidak ditemukan.</CommandEmpty>
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
                  {getMutasiFieldError(errors, 'anggota_id') && (
                    <p className="text-xs text-destructive">
                      {getMutasiFieldError(errors, 'anggota_id')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cabang_tujuan">
                    Cabang Tujuan <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.kode_cabang_tujuan || form.cabang_tujuan || undefined}
                    onValueChange={handleCabangChange}
                    disabled={formDisabled}
                  >
                    <SelectTrigger id="cabang_tujuan" className="w-full">
                      <SelectValue
                        placeholder={cabangLoading ? 'Memuat cabang...' : 'Pilih cabang tujuan'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {cabangOptionsForSelect.map((opt) => (
                        <SelectItem
                          key={opt.kode_cabang ?? opt.nama_cabang}
                          value={opt.kode_cabang ?? opt.nama_cabang}
                        >
                          {opt.nama_cabang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {getMutasiFieldError(errors, 'cabang_tujuan') && (
                    <p className="text-xs text-destructive">
                      {getMutasiFieldError(errors, 'cabang_tujuan')}
                    </p>
                  )}
                </div>
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
                      <p className="text-xs text-muted-foreground">Cabang Asal</p>
                      <p className="flex items-center gap-1 text-sm font-medium">
                        <Building2 className="size-3.5 text-muted-foreground" />
                        {selectedAnggota.nama_cabang || '-'}
                      </p>
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

              <div className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="tanggal_mulai_mutasi">
                    Tanggal Mulai Mutasi <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tanggal_mulai_mutasi"
                    type="date"
                    value={form.tanggal_mulai_mutasi}
                    onChange={(e) => setField('tanggal_mulai_mutasi', e.target.value)}
                    disabled={formDisabled}
                    aria-invalid={!!getMutasiFieldError(errors, 'tanggal_mulai_mutasi')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tanggal efektif mulai berlakunya mutasi.
                  </p>
                  {getMutasiFieldError(errors, 'tanggal_mulai_mutasi') && (
                    <p className="text-xs text-destructive">
                      {getMutasiFieldError(errors, 'tanggal_mulai_mutasi')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nomor_dokumen_mutasi">
                    Nomor Dokumen Mutasi <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nomor_dokumen_mutasi"
                    type="text"
                    placeholder="Contoh: 12/MUT/P2TEL/II/2026"
                    value={form.nomor_dokumen_mutasi}
                    onChange={(e) => setField('nomor_dokumen_mutasi', e.target.value)}
                    disabled={formDisabled}
                    maxLength={100}
                    aria-invalid={!!getMutasiFieldError(errors, 'nomor_dokumen_mutasi')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nomor surat/dokumen resmi (tanpa upload file).
                  </p>
                  {getMutasiFieldError(errors, 'nomor_dokumen_mutasi') && (
                    <p className="text-xs text-destructive">
                      {getMutasiFieldError(errors, 'nomor_dokumen_mutasi')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tanggal_dokumen_mutasi">
                    Tanggal Dokumen Mutasi <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tanggal_dokumen_mutasi"
                    type="date"
                    value={form.tanggal_dokumen_mutasi}
                    onChange={(e) => setField('tanggal_dokumen_mutasi', e.target.value)}
                    disabled={formDisabled}
                    aria-invalid={!!getMutasiFieldError(errors, 'tanggal_dokumen_mutasi')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tanggal diterbitkannya dokumen mutasi.
                  </p>
                  {getMutasiFieldError(errors, 'tanggal_dokumen_mutasi') && (
                    <p className="text-xs text-destructive">
                      {getMutasiFieldError(errors, 'tanggal_dokumen_mutasi')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-border pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm(INITIAL_FORM);
                    setSelectedAnggota(null);
                    setErrors([]);
                  }}
                  disabled={createMutation.isPending}
                >
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" />
                Riwayat Pengajuan Mutasi
              </CardTitle>
              <CardDescription>
                Seluruh pengajuan mutasi cabang beserta status verifikasinya.
              </CardDescription>
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
                    <p className="text-sm font-medium">Belum ada pengajuan mutasi</p>
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
                        <TableHead className="text-xs">ASAL → TUJUAN</TableHead>
                        <TableHead className="text-xs">TGL MULAI</TableHead>
                        <TableHead className="text-xs">NO. DOKUMEN</TableHead>
                        <TableHead className="text-xs">TGL DOKUMEN</TableHead>
                        <TableHead className="text-xs">STATUS</TableHead>
                        <TableHead className="text-xs text-right">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((row) => {
                        const statusProps = getMutasiCabangStatusProps(row.status);
                        const cancelable = isMutasiCabangCancelable(row.status);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs">{formatDateTime(row.created_at)}</TableCell>
                            <TableCell>
                              <div className="text-xs font-medium">{row.nama_anggota || '-'}</div>
                              <div className="font-mono text-xs text-muted-foreground">{row.nik}</div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.cabang_asal || '-'} <span className="text-muted-foreground">→</span>{' '}
                              <span className="font-medium">{row.cabang_tujuan || '-'}</span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatDateOnly(row.tanggal_mulai_mutasi)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {row.nomor_dokumen_mutasi}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatDateOnly(row.tanggal_dokumen_mutasi)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusProps.variant} appearance="ghost">
                                {statusProps.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {cancelable ? (
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
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
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
    </Fragment>
  );
}

