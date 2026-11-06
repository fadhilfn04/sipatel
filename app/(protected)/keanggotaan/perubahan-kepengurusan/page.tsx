'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ClipboardList,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/FileUpload';
import { MemberSearchModal } from '@/components/anggota/MemberSearchModal';
import { useHasAnyPermission } from '@/lib/hooks/use-rbac';
import { KEPENGURUSAN_MANAGE_PERMISSIONS } from '@/lib/rbac';
import type {
  Anggota,
  AnggotaKepengurusanWithAnggota,
  KepengurusanStatus,
} from '@/lib/supabase';
import {
  JABATAN_FORM_OPTIONS,
  JENIS_KEPENGURUSAN_OPTIONS,
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
  getAlasanPemberhentianLabel,
} from '@/lib/anggota-kepengurusan';
import {
  useCreateKepengurusan,
  useKepengurusanByAnggota,
  useKepengurusanList,
  useUpdateKepengurusanStatus,
} from '@/lib/hooks/use-anggota-kepengurusan-api';

const STEPS = [
  { key: 1, label: 'Cari Anggota' },
  { key: 2, label: 'Pilih Jabatan & SK' },
  { key: 3, label: 'Tinjau & Kirim' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

const INITIAL_FORM = {
  jenis: '',
  jabatan: '',
  periode: '',
  tanggal_mulai: '',
  tanggal_selesai: '',
  nomor_sk: '',
  tanggal_sk: '',
  file_sk: '',
  catatan_pengaju: '',
  keterangan: '',
  alasan_pemberhentian: '',
  keterangan_alasan: '',
};

const JENIS_LABELS: Record<string, string> = {
  angkat: 'Angkat / Tetapkan Jabatan',
  pindah: 'Pindah Jabatan',
  berhentikan: 'Berhentikan Jabatan',
};

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function PerubahanKepengurusanPage() {
  const canManage = useHasAnyPermission(KEPENGURUSAN_MANAGE_PERMISSIONS);

  const [step, setStep] = useState<StepKey>(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [member, setMember] = useState<Anggota | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<KepengurusanValidationError[]>([]);
  const [lastResult, setLastResult] = useState<{ nama: string; status: string } | null>(null);

  // List filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [debouncedListSearch, setDebouncedListSearch] = useState('');

  // Decision dialog
  const [decision, setDecision] = useState<{
    row: AnggotaKepengurusanWithAnggota;
    status: KepengurusanStatus;
    title: string;
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedListSearch(listSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [listSearch]);

  const { data: listData, isLoading: listLoading } = useKepengurusanList({
    status: statusFilter,
    search: debouncedListSearch,
    page: 1,
    limit: 50,
  });
  const { data: memberRiwayat, isLoading: riwayatLoading } = useKepengurusanByAnggota(
    member?.id || '',
  );

  const createMutation = useCreateKepengurusan();
  const updateStatusMutation = useUpdateKepengurusanStatus();

  const submissions: AnggotaKepengurusanWithAnggota[] = listData?.data || [];
  const riwayat: AnggotaKepengurusanWithAnggota[] = memberRiwayat || [];

  const setField = (field: keyof typeof INITIAL_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => prev.filter((e) => e.field !== field));
  };

  const handleSelectMember = (selected: Anggota) => {
    setSearchOpen(false);

    if (selected.status_anggota === 'meninggal') {
      toast.error('Anggota tidak dapat diubah kepengurusannya', {
        description: 'Anggota sudah tercatat meninggal dunia.',
      });
      return;
    }
    if (selected.status_keanggotaan === 'berhenti') {
      toast.error('Anggota tidak dapat diubah kepengurusannya', {
        description: 'Keanggotaan anggota sudah berakhir.',
      });
      return;
    }

    setMember(selected);
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
    const validationErrors = validateKepengurusanInput({
      anggota_id: member?.id,
      ...form,
    });
    setErrors(validationErrors);
    if (validationErrors.length > 0) {
      toast.error('Periksa kembali data pengajuan', {
        description: validationErrors[0].message,
      });
      return;
    }
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!member) return;
    const validationErrors = validateKepengurusanInput({
      anggota_id: member.id,
      ...form,
    });
    setErrors(validationErrors);
    if (validationErrors.length > 0) {
      toast.error('Periksa kembali data pengajuan', {
        description: validationErrors[0].message,
      });
      setStep(2);
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        anggota_id: member.id,
        jenis: form.jenis as any,
        jabatan: form.jenis === 'berhentikan' ? '' : form.jabatan,
        periode: form.periode || null,
        tanggal_mulai: form.tanggal_mulai,
        tanggal_selesai: form.tanggal_selesai || null,
        nomor_sk: form.nomor_sk,
        tanggal_sk: form.tanggal_sk,
        file_sk: form.file_sk || null,
        keterangan: form.keterangan || null,
        catatan_pengaju: form.catatan_pengaju,
        alasan_pemberhentian:
          form.jenis === 'berhentikan' ? ((form.alasan_pemberhentian || null) as any) : null,
        keterangan_alasan: form.jenis === 'berhentikan' ? form.keterangan_alasan || null : null,
      });

      const isSaved = result.status === 'tersimpan';
      setLastResult({ nama: member.nama_anggota, status: result.status || 'menunggu' });
      toast.success(
        isSaved
          ? 'Perubahan kepengurusan berhasil ditetapkan'
          : 'Pengajuan dikirim — menunggu verifikasi PC',
        { description: result.message },
      );

      setStep(1);
      setMember(null);
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

  const jabatanEfektif = form.jenis === 'berhentikan' ? 'Anggota' : form.jabatan || '-';

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Perubahan Kepengurusan"
            description="Kelola perubahan posisi/jabatan kepengurusan anggota (angkat, pindah, berhentikan) beserta SK pengangkatan."
          />
        </Toolbar>
      </Container>

      {!canManage ? (
        <Container>
          <Alert variant="destructive">
            <AlertTitle>Akses ditolak</AlertTitle>
            <AlertDescription>
              Anda tidak memiliki akses ke menu Perubahan Kepengurusan. Fitur ini khusus
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
                    ? `Perubahan ditetapkan — ${lastResult.nama}`
                    : `Pengajuan terkirim — ${lastResult.nama} menunggu verifikasi`}
                </AlertTitle>
                <AlertDescription>
                  {lastResult.status === 'tersimpan'
                    ? 'Posisi kepengurusan anggota telah diperbarui.'
                    : 'Posisi kepengurusan belum berubah sampai pengajuan disetujui PP.'}
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

            {/* Langkah 1 — Cari Anggota */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="size-5" />
                    Cari Anggota
                  </CardTitle>
                  <CardDescription>
                    Cari anggota berdasarkan <strong>NIK</strong> (nomor induk) atau{' '}
                    <strong>nama</strong>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={() => setSearchOpen(true)}>
                    <Search className="mr-2 h-4 w-4" />
                    Cari & Pilih Anggota
                  </Button>
                  <Alert variant="info">
                    <AlertTitle>Yang dapat diubah di menu ini</AlertTitle>
                    <AlertDescription>
                      Jabatan/posisi kepengurusan, periode & masa jabatan, tanggal mulai/selesai,
                      nomor & tanggal SK pengangkatan, serta dokumen SK. Status keanggotaan,
                      status anggota, kategori, dan data cabang <strong>tidak</strong> diubah
                      di sini.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Langkah 2 — Form */}
            {step === 2 && member && (
              <Fragment>
                <Card>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <UserRoundPen className="size-5" />
                        Pilih Jabatan & SK
                      </CardTitle>
                      <CardDescription>
                        Lengkapi informasi perubahan kepengurusan anggota.
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Ringkasan anggota */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border p-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Nama</Label>
                        <p className="text-sm font-medium">{member.nama_anggota}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">NIK</Label>
                        <p className="text-sm font-medium">{member.nik}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Posisi Saat Ini</Label>
                        <div className="mt-1">
                          <Badge
                            variant={getPosisiKepengurusanProps(member.posisi_kepengurusan).variant}
                          >
                            {getPosisiKepengurusanProps(member.posisi_kepengurusan).label}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Jenis Perubahan *</Label>
                        <Select value={form.jenis} onValueChange={(v) => setField('jenis', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih jenis perubahan" />
                          </SelectTrigger>
                          <SelectContent>
                            {JENIS_KEPENGURUSAN_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {form.jenis !== 'berhentikan' ? (
                        <div className="space-y-2">
                          <Label>Jabatan / Posisi *</Label>
                          <Select value={form.jabatan} onValueChange={(v) => setField('jabatan', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih jabatan" />
                            </SelectTrigger>
                            <SelectContent>
                              {JABATAN_FORM_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Hasil Pemberhentian</Label>
                          <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                            Kembali menjadi <strong>Anggota</strong>
                          </div>
                        </div>
                      )}

                      {form.jenis === 'berhentikan' && (
                        <>
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

                          {form.alasan_pemberhentian === 'lainnya' && (
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
                        </>
                      )}

                      <div className="space-y-2">
                        <Label>Periode / Masa Jabatan</Label>
                        <Input
                          placeholder="Contoh: 2025-2030"
                          value={form.periode}
                          onChange={(e) => setField('periode', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tanggal Mulai Jabatan *</Label>
                        <Input
                          type="date"
                          value={form.tanggal_mulai}
                          onChange={(e) => setField('tanggal_mulai', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tanggal Selesai Jabatan</Label>
                        <Input
                          type="date"
                          value={form.tanggal_selesai}
                          onChange={(e) => setField('tanggal_selesai', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Kosongkan bila jabatan tidak memiliki batas akhir.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Nomor SK *</Label>
                        <Input
                          placeholder="Nomor SK pengangkatan/pemberhentian"
                          value={form.nomor_sk}
                          onChange={(e) => setField('nomor_sk', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tanggal SK *</Label>
                        <Input
                          type="date"
                          value={form.tanggal_sk}
                          onChange={(e) => setField('tanggal_sk', e.target.value)}
                        />
                      </div>
                    </div>

                    <FileUpload
                      value={form.file_sk}
                      onChange={(url) => setField('file_sk', url)}
                      bucket="anggota"
                      folder={form.jenis === 'berhentikan' ? 'sk-pemberhentian' : 'sk-pengangkatan'}
                      label="Dokumen SK (PDF / Gambar, opsional)"
                    />

                    <div className="space-y-2">
                      <Label>Alasan / Catatan Pengajuan *</Label>
                      <Textarea
                        placeholder="Jelaskan alasan perubahan jabatan (minimal 10 karakter)"
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
                      Riwayat Kepengurusan Anggota
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {riwayatLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat…
                      </div>
                    ) : riwayat.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Belum ada riwayat perubahan kepengurusan untuk anggota ini.
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
                                  {JENIS_LABELS[row.jenis] || row.jenis}
                                </TableCell>
                                <TableCell className="text-xs font-medium">{row.jabatan}</TableCell>
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
            {step === 3 && member && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-5" />
                    Tinjau & Kirim
                  </CardTitle>
                  <CardDescription>
                    Periksa kembali rincian perubahan kepengurusan di bawah ini.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Anggota</Label>
                      <p className="font-medium">
                        {member.nama_anggota} ({member.nik})
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Jenis Perubahan</Label>
                      <p className="font-medium">{JENIS_LABELS[form.jenis] || form.jenis}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Posisi Saat Ini → Baru</Label>
                      <p className="font-medium">
                        {getPosisiKepengurusanProps(member.posisi_kepengurusan).label} →{' '}
                        {jabatanEfektif}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Periode</Label>
                      <p className="font-medium">{form.periode || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Masa Jabatan</Label>
                      <p className="font-medium">
                        {formatDateOnly(form.tanggal_mulai)} s/d{' '}
                        {formatDateOnly(form.tanggal_selesai)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">SK</Label>
                      <p className="font-medium">
                        {form.nomor_sk} ({formatDateOnly(form.tanggal_sk)})
                      </p>
                    </div>
                    {form.jenis === 'berhentikan' && (
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">Alasan Pemberhentian</Label>
                        <p className="font-medium">
                          {getAlasanPemberhentianLabel(form.alasan_pemberhentian)}
                          {form.alasan_pemberhentian === 'lainnya' && form.keterangan_alasan
                            ? ` — ${form.keterangan_alasan}`
                            : ''}
                        </p>
                      </div>
                    )}
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
                      <Label className="text-xs text-muted-foreground">Alasan</Label>
                      <p className="font-medium whitespace-pre-wrap">{form.catatan_pengaju}</p>
                    </div>
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

            {/* Daftar pengajuan & riwayat kepengurusan */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="size-5" />
                  Pengajuan & Riwayat Kepengurusan
                </CardTitle>
                <CardDescription>
                  Riwayat perubahan kepengurusan terbaru. Gunakan aksi untuk verifikasi PC,
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
                    Belum ada pengajuan perubahan kepengurusan.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Anggota</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Mulai</TableHead>
                        <TableHead>No SK</TableHead>
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
                              {JENIS_LABELS[row.jenis] || row.jenis}
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
                                    onClick={() => openDecision(row, 'disetujui_pp', 'Disetujui PP')}
                                  >
                                    Setujui PP
                                  </Button>
                                )}
                                {(row.status === 'menunggu' || row.status === 'diverifikasi_pc') && (
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
                                        onClick={() => openDecision(row, 'dibatalkan', 'Dibatalkan')}
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
                  {JENIS_LABELS[decision.row.jenis] || decision.row.jenis} ke{' '}
                  <strong>{decision.row.jabatan}</strong>
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
              disabled={updateStatusMutation.isPending || (decision?.status === 'ditolak' && !decisionNote.trim())}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onMemberSelect={handleSelectMember}
      />
    </Fragment>
  );
}

