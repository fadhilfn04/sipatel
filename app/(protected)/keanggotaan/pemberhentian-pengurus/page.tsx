'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ClipboardList,
  Info,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  ThumbsDown,
  UserRoundPen,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Toolbar, ToolbarHeading } from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/FileUpload';
import { useHasAnyPermission } from '@/lib/hooks/use-rbac';
import { KEPENGURUSAN_MANAGE_PERMISSIONS } from '@/lib/rbac';
import type { AnggotaKepengurusanWithAnggota, KepengurusanStatus } from '@/lib/supabase';
import {
  validateKepengurusanInput,
  type KepengurusanValidationError,
} from '@/lib/utils/kepengurusan-validation';
import {
  KEPENGURUSAN_STATUS_FILTER_OPTIONS,
  getKepengurusanStatusProps,
  isKepengurusanCancelable,
} from '@/lib/workflow/kepengurusan-status';
import {
  getPosisiKepengurusanProps,
  ALASAN_PEMBERHENTIAN_OPTIONS,
  ALASAN_PEMBERHENTIAN_LAINNYA,
  getAlasanPemberhentianLabel,
} from '@/lib/anggota-kepengurusan';
import {
  useCreateKepengurusan,
  useKepengurusanByAnggota,
  useKepengurusanList,
  usePengurusAktifList,
  useUpdateKepengurusanStatus,
  type PengurusAktifItem,
} from '@/lib/hooks/use-anggota-kepengurusan-api';

const STEPS = [
  { key: 1, label: 'Pilih Pengurus' },
  { key: 2, label: 'Form Pemberhentian' },
  { key: 3, label: 'Tinjau & Kirim' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

/**
 * Form pemberhentian — field dipetakan ke CreateKepengurusanInput:
 * tanggal_efektif → tanggal_mulai (baris jenis 'berhentikan'),
 * catatan_pengaju → uraian alasan, dst. (lihat docs/pemberhentian-pengurus-audit.md §6).
 */
const INITIAL_FORM = {
  tanggal_efektif: '',
  alasan_pemberhentian: '',
  keterangan_alasan: '',
  nomor_sk: '',
  tanggal_sk: '',
  file_sk: '',
  catatan_pengaju: '',
  keterangan: '',
};

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Hari ini (YYYY-MM-DD) menurut WIB — batas maksimum tanggal efektif. */
function todayIsoDate(): string {
  const now = new Date();
  const jakarta = new Date(now.getTime() + 7 * 60 * 60 * 1000); // WIB (UTC+7)
  return jakarta.toISOString().slice(0, 10);
}

export default function PemberhentianPengurusPage() {
  const canManage = useHasAnyPermission(KEPENGURUSAN_MANAGE_PERMISSIONS);

  const [step, setStep] = useState<StepKey>(1);
  const [selected, setSelected] = useState<PengurusAktifItem | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<KepengurusanValidationError[]>([]);
  const [lastResult, setLastResult] = useState<{ nama: string; status: string } | null>(null);

  // Langkah 1 — pencarian pengurus aktif (debounced).
  const [pengurusSearch, setPengurusSearch] = useState('');
  const [debouncedPengurusSearch, setDebouncedPengurusSearch] = useState('');

  // Panel bawah — filter daftar pengajuan pemberhentian.
  const [statusFilter, setStatusFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [debouncedListSearch, setDebouncedListSearch] = useState('');

  // Dialog keputusan (verifikasi PC / keputusan PP / tolak / batal).
  const [decision, setDecision] = useState<{
    row: AnggotaKepengurusanWithAnggota;
    status: KepengurusanStatus;
    title: string;
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPengurusSearch(pengurusSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [pengurusSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedListSearch(listSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [listSearch]);

  const { data: pengurusData, isLoading: pengurusLoading } = usePengurusAktifList({
    search: debouncedPengurusSearch,
    page: 1,
    limit: 50,
  });

  const { data: listData, isLoading: listLoading } = useKepengurusanList({
    status: statusFilter,
    search: debouncedListSearch,
    jenis: 'berhentikan',
    page: 1,
    limit: 50,
  });

  const { data: memberRiwayat, isLoading: riwayatLoading } = useKepengurusanByAnggota(
    selected?.id || '',
  );

  const createMutation = useCreateKepengurusan();
  const updateStatusMutation = useUpdateKepengurusanStatus();

  const pengurusList: PengurusAktifItem[] = pengurusData?.data || [];
  const submissions: AnggotaKepengurusanWithAnggota[] = listData?.data || [];
  const riwayat: AnggotaKepengurusanWithAnggota[] = memberRiwayat || [];


  const setField = (field: keyof typeof INITIAL_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => prev.filter((e) => e.field !== field));
  };

  /** Batas tanggal efektif: tidak mendahului mulai jabatan aktif & tidak masa depan. */
  const minTanggalEfektif = selected?.jabatan_aktif?.tanggal_mulai
    ? String(selected.jabatan_aktif.tanggal_mulai).slice(0, 10)
    : undefined;

  const buildValidationInput = () => ({
    anggota_id: selected?.id,
    jenis: 'berhentikan',
    jabatan: '',
    tanggal_mulai: form.tanggal_efektif,
    tanggal_selesai: null,
    nomor_sk: form.nomor_sk,
    tanggal_sk: form.tanggal_sk,
    file_sk: form.file_sk,
    catatan_pengaju: form.catatan_pengaju,
    keterangan: form.keterangan,
    alasan_pemberhentian: form.alasan_pemberhentian,
    keterangan_alasan: form.keterangan_alasan,
  });

  const handleSelectPengurus = (pengurus: PengurusAktifItem) => {
    if (pengurus.status_anggota === 'meninggal') {
      toast.error('Pengurus sudah tercatat meninggal dunia', {
        description: 'Penutupan jabatan atas anggota meninggal ditangani terpisah (Fase 2).',
      });
      return;
    }
    if (pengurus.pengajuan_aktif) {
      toast.error('Masih ada pengajuan kepengurusan yang berjalan', {
        description:
          'Selesaikan atau batalkan pengajuan sebelumnya untuk anggota ini terlebih dahulu.',
      });
      return;
    }

    setSelected(pengurus);
    setForm(INITIAL_FORM);
    setErrors([]);
    setLastResult(null);
    setStep(2);
  };

  const handleReset = () => {
    setForm(INITIAL_FORM);
    setErrors([]);
  };


  const goToReview = () => {
    if (!selected) return;

    const validationErrors = validateKepengurusanInput(buildValidationInput());
    if (minTanggalEfektif && form.tanggal_efektif && form.tanggal_efektif < minTanggalEfektif) {
      validationErrors.push({
        field: 'tanggal_mulai',
        message: `Tanggal efektif pemberhentian tidak boleh lebih awal dari tanggal mulai jabatan aktif (${minTanggalEfektif}).`,
      });
    }

    setErrors(validationErrors);
    if (validationErrors.length > 0) {
      toast.error('Periksa kembali data pemberhentian', {
        description: validationErrors[0].message,
      });
      return;
    }
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!selected) return;

    const validationErrors = validateKepengurusanInput(buildValidationInput());
    if (minTanggalEfektif && form.tanggal_efektif && form.tanggal_efektif < minTanggalEfektif) {
      validationErrors.push({
        field: 'tanggal_mulai',
        message: `Tanggal efektif pemberhentian tidak boleh lebih awal dari tanggal mulai jabatan aktif (${minTanggalEfektif}).`,
      });
    }

    setErrors(validationErrors);
    if (validationErrors.length > 0) {
      toast.error('Periksa kembali data pemberhentian', {
        description: validationErrors[0].message,
      });
      setStep(2);
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        anggota_id: selected.id,
        jenis: 'berhentikan',
        jabatan: '',
        tanggal_mulai: form.tanggal_efektif,
        tanggal_selesai: null,
        nomor_sk: form.nomor_sk,
        tanggal_sk: form.tanggal_sk,
        file_sk: form.file_sk || null,
        keterangan: form.keterangan || null,
        catatan_pengaju: form.catatan_pengaju,
        alasan_pemberhentian: (form.alasan_pemberhentian || null) as any,
        keterangan_alasan: form.keterangan_alasan || null,
      });

      const isSaved = result.status === 'tersimpan';
      setLastResult({ nama: selected.nama_anggota || '-', status: result.status || 'menunggu' });
      toast.success(
        isSaved
          ? 'Pemberhentian pengurus berhasil ditetapkan'
          : 'Pengajuan pemberhentian dikirim — menunggu verifikasi PC',
        { description: result.message },
      );

      setStep(1);
      setSelected(null);
      setForm(INITIAL_FORM);
      setErrors([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengirim pengajuan';
      toast.error('Pengajuan gagal dikirim', { description: message });
    }
  };

  const openDecision = (
    row: AnggotaKepengurusanWithAnggota,
    status: KepengurusanStatus,
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


  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Pemberhentian Pengurus"
            description="Catat pemberhentian anggota dari jabatan kepengurusan dengan tanggal efektif, alasan, dan SK pemberhentian. Status keanggotaan tidak berubah."
          />
        </Toolbar>
      </Container>

      {!canManage ? (
        <Container>
          <Alert variant="destructive">
            <AlertTitle>Akses ditolak</AlertTitle>
            <AlertDescription>
              Anda tidak memiliki akses ke menu Pemberhentian Pengurus. Fitur ini khusus
              pengurus/admin dengan hak kelola keanggotaan.
            </AlertDescription>
          </Alert>
        </Container>
      ) : (
        <Container>
          <div className="grid gap-5 lg:gap-7.5">
            {/* Indikator langkah */}
            <div className="flex flex-wrap items-center gap-2">
              {STEPS.map((item, index) => (
                <div key={item.key} className="flex items-center gap-2">
                  <Badge
                    variant={
                      step === item.key ? 'success' : step > item.key ? 'secondary' : 'outline'
                    }
                  >
                    {index + 1}. {item.label}
                  </Badge>
                  {index < STEPS.length - 1 && (
                    <span className="text-muted-foreground">→</span>
                  )}
                </div>
              ))}
            </div>

            {/* Hasil proses sebelumnya */}
            {lastResult && (
              <Alert variant={lastResult.status === 'tersimpan' ? 'success' : 'info'}>
                <CheckCircle2 className="size-5" />
                <AlertTitle>
                  {lastResult.status === 'tersimpan'
                    ? `Pemberhentian ditetapkan — ${lastResult.nama}`
                    : `Pengajuan terkirim — ${lastResult.nama} menunggu verifikasi`}
                </AlertTitle>
                <AlertDescription>
                  {lastResult.status === 'tersimpan'
                    ? 'Jabatan kepengurusan telah berakhir; anggota kembali menjadi Anggota. Status keanggotaan tidak berubah.'
                    : 'Jabatan belum berakhir sampai pengajuan disetujui PP.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Pesan error validasi */}
            {errors.length > 0 && step === 2 && (
              <Alert variant="destructive">
                <AlertTitle>Periksa kembali input Anda</AlertTitle>
                <AlertDescription>
                  <ul className="list-inside list-disc space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>{error.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}


            {/* Langkah 1 — Pilih Pengurus */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="size-5" />
                    Pilih Pengurus
                  </CardTitle>
                  <CardDescription>
                    Daftar anggota yang sedang memangku jabatan kepengurusan. Pilih pengurus
                    yang akan diberhentikan dari jabatannya.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative sm:max-w-xs flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Cari NIK / nama pengurus"
                        value={pengurusSearch}
                        onChange={(e) => setPengurusSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {pengurusLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Memuat daftar pengurus…
                    </div>
                  ) : pengurusList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Tidak ada pengurus aktif yang cocok. Jabatan hanya dapat diberhentikan
                      bila anggota memiliki posisi kepengurusan.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pengurus</TableHead>
                          <TableHead>Cabang</TableHead>
                          <TableHead>Jabatan Aktif</TableHead>
                          <TableHead>Sejak / Periode</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {pengurusList.map((row) => {
                          const posisiProps = getPosisiKepengurusanProps(
                            row.jabatan_aktif?.jabatan || row.posisi_kepengurusan,
                          );
                          const meninggal = row.status_anggota === 'meninggal';
                          const berhentiKeanggotaan = row.status_keanggotaan === 'berhenti';
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="text-xs">
                                <div className="font-medium">{row.nama_anggota || '-'}</div>
                                <div className="text-muted-foreground">{row.nik || '-'}</div>
                              </TableCell>
                              <TableCell className="text-xs">{row.nama_cabang || '-'}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={posisiProps.variant}
                                  appearance="ghost"
                                  className="text-xs"
                                >
                                  {posisiProps.label}
                                </Badge>
                                {!row.jabatan_aktif && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    (pra-sistem)
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.jabatan_aktif
                                  ? `${formatDateOnly(row.jabatan_aktif.tanggal_mulai)}${row.jabatan_aktif.periode ? ` · ${row.jabatan_aktif.periode}` : ''}`
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                {meninggal ? (
                                  <Badge
                                    variant="destructive"
                                    appearance="ghost"
                                    className="text-xs"
                                  >
                                    Meninggal
                                  </Badge>
                                ) : berhentiKeanggotaan ? (
                                  <Badge
                                    variant="secondary"
                                    appearance="ghost"
                                    className="text-xs"
                                  >
                                    Keanggotaan Berhenti
                                  </Badge>
                                ) : (
                                  <Badge variant="success" appearance="ghost" className="text-xs">
                                    Aktif
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={meninggal || row.pengajuan_aktif}
                                  title={
                                    row.pengajuan_aktif
                                      ? 'Masih ada pengajuan kepengurusan berjalan'
                                      : meninggal
                                        ? 'Anggota meninggal dunia'
                                        : undefined
                                  }
                                  onClick={() => handleSelectPengurus(row)}
                                >
                                  Pilih
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}


                  <Alert variant="info">
                    <Info className="size-5" />
                    <AlertTitle>Pemberhentian jabatan ≠ pengakhiran keanggotaan</AlertTitle>
                    <AlertDescription>
                      Proses ini hanya mengakhiri jabatan kepengurusan — anggota kembali
                      menjadi <strong>Anggota</strong> biasa dan status keanggotaannya tetap
                      aktif. Untuk mengakhiri keanggotaan, gunakan menu{' '}
                      <strong>Pengakhiran Keanggotaan</strong>.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Langkah 2 — Form Pemberhentian */}
            {step === 2 && selected && (
              <Fragment>
                <Card>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <UserRoundPen className="size-5" />
                        Form Pemberhentian
                      </CardTitle>
                      <CardDescription>
                        Lengkapi informasi pemberhentian pengurus dari jabatannya.
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Ringkasan pengurus (read-only) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border p-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Nama</Label>
                        <p className="text-sm font-medium">{selected.nama_anggota || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">NIK</Label>
                        <p className="text-sm font-medium">{selected.nik || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Cabang</Label>
                        <p className="text-sm font-medium">{selected.nama_cabang || '-'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border p-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Jabatan Saat Ini</Label>
                        <div className="mt-1">
                          <Badge
                            variant={
                              getPosisiKepengurusanProps(
                                selected.jabatan_aktif?.jabatan ||
                                  selected.posisi_kepengurusan,
                              ).variant
                            }
                          >
                            {
                              getPosisiKepengurusanProps(
                                selected.jabatan_aktif?.jabatan ||
                                  selected.posisi_kepengurusan,
                              ).label
                            }
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Hasil Pemberhentian</Label>
                        <div className="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">
                          Kembali menjadi <strong>Anggota</strong>
                        </div>
                      </div>
                      {selected.jabatan_aktif && (
                        <>
                          <div>
                            <Label className="text-xs text-muted-foreground">Periode Jabatan</Label>
                            <p className="text-sm font-medium">
                              {selected.jabatan_aktif.periode || '-'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Mulai Jabatan</Label>
                            <p className="text-sm font-medium">
                              {formatDateOnly(selected.jabatan_aktif.tanggal_mulai)}
                            </p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-xs text-muted-foreground">
                              No SK Pengangkatan
                            </Label>
                            <p className="text-sm font-medium">
                              {selected.jabatan_aktif.nomor_sk || '-'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <Alert variant="info">
                      <Info className="size-5" />
                      <AlertTitle>Status keanggotaan tetap aktif</AlertTitle>
                      <AlertDescription>
                        Pemberhentian jabatan tidak mengakhiri keanggotaan. Gunakan menu
                        Pengakhiran Keanggotaan bila ingin mengakhiri keanggotaan.
                      </AlertDescription>
                    </Alert>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tanggal Efektif Pemberhentian *</Label>
                        <Input
                          type="date"
                          value={form.tanggal_efektif}
                          min={minTanggalEfektif}
                          max={todayIsoDate()}
                          onChange={(e) => setField('tanggal_efektif', e.target.value)}
                        />
                        {minTanggalEfektif && (
                          <p className="text-xs text-muted-foreground">
                            Tidak boleh lebih awal dari mulai jabatan aktif
                            ({minTanggalEfektif}).
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Alasan Pemberhentian *</Label>
                        <Select
                          value={form.alasan_pemberhentian}
                          onValueChange={(v) => setField('alasan_pemberhentian', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih alasan pemberhentian" />
                          </SelectTrigger>
                          <SelectContent>
                            {ALASAN_PEMBERHENTIAN_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {form.alasan_pemberhentian === ALASAN_PEMBERHENTIAN_LAINNYA && (
                        <div className="space-y-2 md:col-span-2">
                          <Label>Keterangan Alasan *</Label>
                          <Textarea
                            placeholder="Jelaskan alasan pemberhentian lainnya (minimal 10 karakter)"
                            value={form.keterangan_alasan}
                            onChange={(e) => setField('keterangan_alasan', e.target.value)}
                            rows={2}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Nomor SK Pemberhentian *</Label>
                        <Input
                          placeholder="Nomor SK pemberhentian"
                          value={form.nomor_sk}
                          onChange={(e) => setField('nomor_sk', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tanggal SK *</Label>
                        <Input
                          type="date"
                          value={form.tanggal_sk}
                          max={form.tanggal_efektif || undefined}
                          onChange={(e) => setField('tanggal_sk', e.target.value)}
                        />
                      </div>
                    </div>

                    <FileUpload
                      value={form.file_sk}
                      onChange={(url) => setField('file_sk', url)}
                      bucket="anggota"
                      folder="sk-pemberhentian"
                      label="Dokumen SK Pemberhentian (PDF / Gambar — wajib bila alasan Diberhentikan oleh Organisasi)"
                    />

                    <div className="space-y-2">
                      <Label>Uraian Alasan / Catatan Pengajuan *</Label>
                      <Textarea
                        placeholder="Jelaskan uraian alasan pemberhentian (minimal 10 karakter)"
                        value={form.catatan_pengaju}
                        onChange={(e) => setField('catatan_pengaju', e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Keterangan Tambahan</Label>
                      <Textarea
                        placeholder="Catatan tambahan (opsional)"
                        value={form.keterangan}
                        onChange={(e) => setField('keterangan', e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep(1)}>
                        Kembali
                      </Button>
                      <Button onClick={goToReview} disabled={createMutation.isPending}>
                        Lanjut Tinjau
                      </Button>
                    </div>
                  </CardContent>
                </Card>


                {/* Riwayat anggota terpilih */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="size-5" />
                      Riwayat Kepengurusan Pengurus
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {riwayatLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat…
                      </div>
                    ) : riwayat.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Belum ada riwayat perubahan kepengurusan untuk pengurus ini.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Jenis</TableHead>
                            <TableHead>Jabatan</TableHead>
                            <TableHead>Mulai</TableHead>
                            <TableHead>Selesai</TableHead>
                            <TableHead>No SK</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {riwayat.map((row) => {
                            const statusProps = getKepengurusanStatusProps(row.status);
                            return (
                              <TableRow key={row.id}>
                                <TableCell className="text-xs">
                                  {row.jenis === 'berhentikan' ? 'Berhentikan' : row.jenis}
                                </TableCell>
                                <TableCell className="text-xs font-medium">
                                  {row.jabatan}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {formatDateOnly(row.tanggal_mulai)}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {formatDateOnly(row.tanggal_selesai)}
                                </TableCell>
                                <TableCell className="text-xs">{row.nomor_sk}</TableCell>
                                <TableCell>
                                  <Badge variant={statusProps.variant} appearance="ghost">
                                    {statusProps.label}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

              </Fragment>
            )}


            {/* Langkah 3 — Tinjau & Kirim */}
            {step === 3 && selected && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-5" />
                    Tinjau & Kirim
                  </CardTitle>
                  <CardDescription>
                    Periksa kembali rincian pemberhentian pengurus di bawah ini.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Pengurus</Label>
                      <p className="font-medium">
                        {selected.nama_anggota || '-'} ({selected.nik || '-'})
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Cabang</Label>
                      <p className="font-medium">{selected.nama_cabang || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Jabatan Saat Ini → Hasil
                      </Label>
                      <p className="font-medium">
                        {getPosisiKepengurusanProps(
                          selected.jabatan_aktif?.jabatan || selected.posisi_kepengurusan,
                        ).label}{' '}
                        → Anggota
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Tanggal Efektif Pemberhentian
                      </Label>
                      <p className="font-medium">{formatDateOnly(form.tanggal_efektif)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Alasan Pemberhentian</Label>
                      <p className="font-medium">
                        {getAlasanPemberhentianLabel(form.alasan_pemberhentian)}
                        {form.alasan_pemberhentian === ALASAN_PEMBERHENTIAN_LAINNYA &&
                        form.keterangan_alasan
                          ? ` — ${form.keterangan_alasan}`
                          : ''}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">SK Pemberhentian</Label>
                      <p className="font-medium">
                        {form.nomor_sk} ({formatDateOnly(form.tanggal_sk)})
                      </p>
                    </div>
                    {form.file_sk && (
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">Dokumen SK</Label>
                        <a
                          href={form.file_sk}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary underline"
                        >
                          Lihat dokumen
                        </a>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Uraian Alasan</Label>
                      <p className="font-medium whitespace-pre-wrap">{form.catatan_pengaju}</p>
                    </div>
                    {form.keterangan && (
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">
                          Keterangan Tambahan
                        </Label>
                        <p className="font-medium whitespace-pre-wrap">{form.keterangan}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setStep(2)}
                      disabled={createMutation.isPending}
                    >
                      Kembali
                    </Button>
                    <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                      {createMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      Kirim Pengajuan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}


            {/* Daftar pengajuan & riwayat pemberhentian */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="size-5" />
                  Pengajuan & Riwayat Pemberhentian
                </CardTitle>
                <CardDescription>
                  Riwayat pemberhentian pengurus terbaru. Gunakan aksi untuk verifikasi PC,
                  keputusan PP, atau pembatalan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative sm:max-w-xs flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Cari NIK / nama anggota"
                      value={listSearch}
                      onChange={(e) => setListSearch(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="sm:w-52">
                      <SelectValue placeholder="Semua status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      {KEPENGURUSAN_STATUS_FILTER_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {listLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Memuat data…
                  </div>
                ) : submissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada pengajuan pemberhentian pengurus.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Anggota</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Tanggal Efektif</TableHead>
                        <TableHead>No SK</TableHead>
                        <TableHead>Alasan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {submissions.map((row) => {
                        const statusProps = getKepengurusanStatusProps(row.status);
                        const cancelable = isKepengurusanCancelable(row.status);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs">
                              <div className="font-medium">
                                {row.anggota?.nama_anggota || row.nama_anggota || '-'}
                              </div>
                              <div className="text-muted-foreground">
                                {row.anggota?.nik || row.nik || '-'}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.jabatan_sebelumnya && (
                                <span className="text-muted-foreground">
                                  {row.jabatan_sebelumnya} →{' '}
                                </span>
                              )}
                              <span className="font-medium">{row.jabatan}</span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatDateOnly(row.tanggal_mulai)}
                            </TableCell>
                            <TableCell className="text-xs">{row.nomor_sk}</TableCell>
                            <TableCell className="text-xs">
                              {getAlasanPemberhentianLabel(row.alasan_pemberhentian)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusProps.variant} appearance="ghost">
                                {statusProps.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1">
                                {row.status === 'menunggu' && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      openDecision(row, 'diverifikasi_pc', 'Verifikasi PC')
                                    }
                                  >
                                    Verifikasi
                                  </Button>
                                )}
                                {row.status === 'diverifikasi_pc' && (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() =>
                                      openDecision(row, 'disetujui_pp', 'Disetujui PP')
                                    }
                                  >
                                    Setujui PP
                                  </Button>
                                )}
                                {(row.status === 'menunggu' ||
                                  row.status === 'diverifikasi_pc') && (
                                  <>
                                    <Button
                                      mode="icon"
                                      variant="dim"
                                      size="sm"
                                      title="Tolak"
                                      onClick={() => openDecision(row, 'ditolak', 'Ditolak')}
                                    >
                                      <ThumbsDown className="h-4 w-4" />
                                    </Button>
                                    {cancelable && (
                                      <Button
                                        mode="icon"
                                        variant="dim"
                                        size="sm"
                                        title="Batalkan"
                                        onClick={() =>
                                          openDecision(row, 'dibatalkan', 'Dibatalkan')
                                        }
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

          </div>
        </Container>
      )}


      {/* Dialog keputusan (verifikasi / setujui / tolak / batalkan) */}
      <Dialog open={!!decision} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision?.title}</DialogTitle>
            <DialogDescription>
              {decision && (
                <>
                  {decision.row.anggota?.nama_anggota || decision.row.nama_anggota || '-'} (
                  {decision.row.anggota?.nik || decision.row.nik || '-'}) —{' '}
                  {decision.row.jabatan_sebelumnya || '-'} → <strong>{decision.row.jabatan}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Textarea
                placeholder={
                  decision?.status === 'ditolak'
                    ? 'Alasan penolakan wajib diisi'
                    : 'Catatan verifikasi/keputusan'
                }
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                rows={3}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>
              Batal
            </Button>
            <Button
              onClick={handleDecision}
              disabled={
                updateStatusMutation.isPending ||
                (decision?.status === 'ditolak' && !decisionNote.trim())
              }
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}

