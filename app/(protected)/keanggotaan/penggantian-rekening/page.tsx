'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  History,
  Loader2,
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react';
import { Toolbar, ToolbarHeading } from '@/layouts/demo1/toolbar';
import {
  computeRekeningDiff,
  isNamaPemilikSesuai,
  type PenggantianRekeningFormValues,
  safeParsePenggantianRekening,
  safeParsePenggantianRekeningForm,
  WAJIB_PEMILIK_SAMA_DENGAN_ANGGOTA,
} from '@/lib/anggota-rekening';
import {
  usePenggantianRekening,
  useRekeningInfo,
} from '@/lib/hooks/use-anggota-api';
import { PERMISSIONS } from '@/lib/rbac';
import type { Anggota } from '@/lib/supabase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { FieldDiffTable } from '@/components/anggota/FieldDiffTable';
import { MemberSearchModal } from '@/components/anggota/MemberSearchModal';
import { PenggantianRekeningForm } from '@/components/anggota/PenggantianRekeningForm';
import { ToastNotification } from '@/components/anggota/ToastNotification';
import { Container } from '@/components/common/container';
import { ProtectedRoute } from '@/components/rbac/protected-route';

const STEPS = [
  { key: 1, label: 'Cari Anggota' },
  { key: 2, label: 'Isi Rekening Baru' },
  { key: 3, label: 'Tinjau & Simpan' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyValues(): PenggantianRekeningFormValues {
  return {
    nama_bank: '',
    kode_bank: null,
    norek_bank: '',
    nama_pemilik_rekening: '',
    tanggal_efektif: todayIso(),
    dokumen_pendukung: '',
  };
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getErrorMessage(error: unknown): string {
  const anyError = error as {
    response?: { data?: { error?: string } };
    message?: string;
  };
  return (
    anyError?.response?.data?.error ||
    anyError?.message ||
    'Terjadi kesalahan'
  );
}

function PenggantianRekeningContent() {
  const [step, setStep] = useState<StepKey>(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [member, setMember] = useState<Anggota | null>(null);
  const [values, setValues] = useState<PenggantianRekeningFormValues>(emptyValues());
  const [alasan, setAlasan] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<{
    nama: string;
    status: 'tersimpan' | 'menunggu';
  } | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

  const info = useRekeningInfo(member?.id || null);
  const mutation = usePenggantianRekening(member?.id || '');

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
  ) => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: '', type: 'success' }),
      4000,
    );
  };

  const rekeningAktif = info.data?.anggota ?? {
    id: member?.id ?? '',
    nik: member?.nik ?? '',
    nama_anggota: member?.nama_anggota ?? '',
    nama_cabang: member?.nama_cabang ?? '',
    nama_bank: member?.nama_bank ?? null,
    norek_bank: member?.norek_bank ?? null,
    nama_pemilik_rekening: member?.nama_pemilik_rekening ?? null,
  };

  const changes = useMemo(
    () => (member ? computeRekeningDiff(member, values) : []),
    [member, values],
  );

  const handleSelectMember = (selected: Anggota) => {
    setMember(selected);
    setSearchOpen(false);
    setValues({
      ...emptyValues(),
      nama_pemilik_rekening: selected.nama_anggota,
    });
    setAlasan('');
    setErrors([]);
    setLastResult(null);
    setStep(2);
  };

  const handleReset = () => {
    setValues({
      ...emptyValues(),
      nama_pemilik_rekening: member?.nama_anggota ?? '',
    });
    setAlasan('');
    setErrors([]);
  };

  const goToReview = () => {
    const parsed = safeParsePenggantianRekeningForm(values);
    if (
      parsed.ok &&
      WAJIB_PEMILIK_SAMA_DENGAN_ANGGOTA &&
      member &&
      !isNamaPemilikSesuai(values.nama_pemilik_rekening, member.nama_anggota)
    ) {
      setErrors([
        `Nama pemilik rekening wajib sama dengan nama anggota (${member.nama_anggota}).`,
      ]);
      return;
    }
    if (changes.length === 0) {
      setErrors([
        'Nomor rekening baru belum diisi atau sama dengan rekening yang terdaftar saat ini.',
      ]);
      return;
    }
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors([]);
    setStep(3);
  };

  const handleSubmit = async () => {
    const parsed = safeParsePenggantianRekening({ ...values, alasan });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setStep(2);
      return;
    }

    try {
      const result = await mutation.mutateAsync({ ...values, alasan });
      const isSaved = result.status === 'tersimpan';
      setLastResult({
        nama: member?.nama_anggota || 'anggota',
        status: result.status,
      });
      showToast(
        isSaved
          ? 'Penggantian rekening berhasil disimpan'
          : 'Usulan dikirim — menunggu persetujuan admin',
        isSaved ? 'success' : 'info',
      );
      setMember(null);
      setValues(emptyValues());
      setAlasan('');
      setStep(1);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  return (
    <Container>
      <Toolbar>
        <ToolbarHeading
          title="Penggantian Rekening"
          description="Ganti nomor rekening anggota — rekening lama tetap tersimpan sebagai histori."
        />
      </Toolbar>

      <div className="space-y-6">
        {/* Indikator langkah */}
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((item, index) => (
            <div key={item.key} className="flex items-center gap-2">
              <Badge
                variant={
                  step === item.key
                    ? 'success'
                    : step > item.key
                      ? 'secondary'
                      : 'outline'
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
                ? `Penggantian tersimpan — ${lastResult.nama}`
                : `Usulan terkirim — ${lastResult.nama} menunggu persetujuan admin`}
            </AlertTitle>
            <AlertDescription>
              {lastResult.status === 'tersimpan'
                ? 'Rekening baru telah menjadi rekening aktif; rekening lama tersimpan pada histori.'
                : 'Rekening aktif belum berubah sampai usulan disetujui oleh admin.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Error validasi */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Periksa kembali input Anda</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
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
                Cari anggota berdasarkan <strong>NIK</strong> atau{' '}
                <strong>nama</strong> untuk mengganti rekeningnya.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => setSearchOpen(true)}>
                <Search className="mr-2 h-4 w-4" />
                Cari & Pilih Anggota
              </Button>
              <Alert variant="info">
                <AlertTitle>Yang dilakukan di menu ini</AlertTitle>
                <AlertDescription>
                  Mengganti bank, nomor rekening, dan nama pemilik rekening
                  anggota, disertai dokumen pendukung (buku tabungan) dan
                  tanggal efektif. Rekening lama tetap tersimpan sebagai
                  histori dan tidak hilang.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Langkah 2 — Informasi & Isi Rekening Baru */}
        {step === 2 && member && (
          <Fragment>
            <Card>
              <CardHeader>
                <CardTitle>{member.nama_anggota}</CardTitle>
                <CardDescription>
                  NIK: {member.nik} · Cabang: {member.nama_cabang}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Rekening Saat Ini
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Bank</p>
                    <p className="font-medium">{rekeningAktif.nama_bank || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nomor Rekening</p>
                    <p className="font-mono font-medium">
                      {rekeningAktif.norek_bank || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pemilik</p>
                    <p className="font-medium">
                      {rekeningAktif.nama_pemilik_rekening || '-'}
                    </p>
                  </div>
                </div>

                {info.data?.has_active_dakem && (
                  <Alert variant="warning" className="mt-4">
                    <AlertTriangle className="size-5" />
                    <AlertTitle>Pengajuan Dana Kematian aktif</AlertTitle>
                    <AlertDescription>
                      Anggota ini memiliki pengajuan Dana Kematian yang masih
                      berjalan. Penggantian rekening <strong>tidak</strong>{' '}
                      mengubah data pengajuan tersebut (pencairan memakai
                      snapshot rekeningnya sendiri), namun harap koordinasikan
                      dengan PC/PP bila diperlukan.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {info.data?.riwayat && info.data.riwayat.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Riwayat Penggantian
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {info.data.riwayat.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono">
                          {row.norek_bank_lama || '—'} → {row.norek_bank}
                        </span>
                        <Badge
                          variant={
                            row.status === 'aktif' ? 'success' : 'secondary'
                          }
                        >
                          {row.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Bank {row.nama_bank} · Pemilik {row.nama_pemilik_rekening}{' '}
                        · Efektif {formatDate(row.tanggal_efektif)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <PenggantianRekeningForm
                  member={member}
                  values={values}
                  onChange={setValues}
                  isPending={mutation.isPending}
                  footer={
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleReset}
                        disabled={mutation.isPending}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                      <Button
                        type="button"
                        onClick={goToReview}
                        disabled={mutation.isPending}
                      >
                        Lanjut ke Tinjau
                      </Button>
                    </>
                  }
                />
              </CardContent>
            </Card>
          </Fragment>
        )}

        {/* Langkah 3 — Tinjau & Simpan */}
        {step === 3 && member && (
          <Card>
            <CardHeader>
              <CardTitle>Tinjau Perubahan — {member.nama_anggota}</CardTitle>
              <CardDescription>
                Periksa perbandingan rekening lama dan baru. Tanda &quot;—&quot;
                berarti nilai kosong.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldDiffTable changes={changes} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Tanggal Efektif
                  </p>
                  <p className="font-medium">
                    {formatDate(values.tanggal_efektif)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Dokumen Pendukung
                  </p>
                  <a
                    href={values.dokumen_pendukung}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    Lihat dokumen
                  </a>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Alasan Penggantian <span className="text-destructive">*</span>
                </label>
                <Textarea
                  rows={3}
                  placeholder="Contoh: buku tabungan lama ditutup oleh bank"
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  disabled={mutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Wajib diisi minimal 10 karakter. Alasan dicatat pada riwayat
                  perubahan bersama pengguna dan waktu perubahan.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={mutation.isPending}
                >
                  Kembali
                </Button>
                <Button onClick={handleSubmit} disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Simpan Penggantian
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/keanggotaan/pengelolaan-data">
              <ClipboardList className="mr-2 h-4 w-4" />
              Lihat Data di Pengelolaan Data
            </Link>
          </Button>
        </div>
      </div>

      <MemberSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onMemberSelect={handleSelectMember}
      />

      <ToastNotification
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ show: false, message: '', type: 'success' })}
      />
    </Container>
  );
}

export default function PenggantianRekeningPage() {
  return (
    <ProtectedRoute permission={PERMISSIONS.MANAGE_KEANGGOTAAN}>
      <PenggantianRekeningContent />
    </ProtectedRoute>
  );
}

