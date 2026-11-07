'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { Toolbar, ToolbarHeading } from '@/layouts/demo1/toolbar';
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  RotateCcw,
  Search,
  UserRoundPen,
} from 'lucide-react';
import {
  computeFieldDiff,
  PERSONAL_DATA_EDITABLE_FIELDS,
  safeParsePerubahanDataPribadi,
} from '@/lib/anggota-perubahan';
import { usePerubahanDataPribadi } from '@/lib/hooks/use-anggota-api';
import { PERMISSIONS } from '@/lib/rbac';
import type { Anggota, UpdateAnggotaInput } from '@/lib/supabase';
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
import { PerubahanDataPribadiForm } from '@/components/anggota/PerubahanDataPribadiForm';
import { ToastNotification } from '@/components/anggota/ToastNotification';
import { Container } from '@/components/common/container';
import { ProtectedRoute } from '@/components/rbac/protected-route';

const STEPS = [
  { key: 1, label: 'Cari Anggota' },
  { key: 2, label: 'Ubah Data' },
  { key: 3, label: 'Tinjau & Simpan' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

/** Prefill seluruh field data pribadi dari data anggota existing. */
function initialValues(member: Anggota): UpdateAnggotaInput {
  const data: Record<string, unknown> = {
    tempat_lahir: member.tempat_lahir ?? '',
    tanggal_lahir: member.tanggal_lahir ?? '',
    jenis_kelamin: member.jenis_kelamin ?? '',
    agama: member.agama ?? '',
    golongan_darah: member.golongan_darah ?? '',
    status_perkawinan: member.status_perkawinan ?? '',
    pasutri: member.pasutri ?? '',
    alamat: member.alamat ?? '',
    rt: member.rt ?? '',
    rw: member.rw ?? '',
    provinsi: member.provinsi ?? '',
    kota: member.kota ?? '',
    kecamatan: member.kecamatan ?? '',
    kelurahan: member.kelurahan ?? '',
    kode_pos: member.kode_pos ?? '',
    nomor_handphone: member.nomor_handphone ?? '',
    nomor_telepon: member.nomor_telepon ?? '',
    email: member.email ?? '',
    sosial_media: member.sosial_media ?? '',
    e_ktp: member.e_ktp ?? '',
    kartu_keluarga: member.kartu_keluarga ?? '',
    npwp: member.npwp ?? '',
    sk_pensiun: member.sk_pensiun ?? '',
    nomor_sk_pensiun: member.nomor_sk_pensiun ?? '',
    status_bpjs: member.status_bpjs ?? null,
    bpjs_kelas: member.bpjs_kelas ?? '',
    bpjs_insentif: member.bpjs_insentif ?? null,
    kategori_datul: member.kategori_datul ?? '',
    media_datul: member.media_datul ?? '',
    kategori_bantuan: member.kategori_bantuan ?? '',
    tanggal_terima_bantuan: member.tanggal_terima_bantuan ?? '',
    gambar_kondisi_tempat_tinggal: member.gambar_kondisi_tempat_tinggal ?? '',
  };
  return data as UpdateAnggotaInput;
}

function getErrorMessage(error: any): string {
  return error?.response?.data?.error || error?.message || 'Terjadi kesalahan';
}

function PerubahanDataPribadiContent() {
  const [step, setStep] = useState<StepKey>(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [member, setMember] = useState<Anggota | null>(null);
  const [values, setValues] = useState<UpdateAnggotaInput>({});
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

  const mutation = usePerubahanDataPribadi(member?.id || '');

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

  // Field yang benar-benar berubah (nilai lama vs baru).
  const changes = useMemo(
    () =>
      member
        ? computeFieldDiff(
            member as unknown as Record<string, unknown>,
            values as unknown as Record<string, unknown>,
            [...PERSONAL_DATA_EDITABLE_FIELDS],
          )
        : [],
    [member, values],
  );

  // Payload parsial: hanya field yang berubah.
  const changedValues = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const change of changes) {
      out[change.field] = (values as unknown as Record<string, unknown>)[
        change.field
      ];
    }
    return out as UpdateAnggotaInput;
  }, [changes, values]);

  const handleSelectMember = (selected: Anggota) => {
    setMember(selected);
    setSearchOpen(false);
    setValues(initialValues(selected));
    setAlasan('');
    setErrors([]);
    setLastResult(null);
    setStep(2);
  };

  const handleReset = () => {
    if (member) {
      setValues(initialValues(member));
      setAlasan('');
      setErrors([]);
    }
  };

  const goToReview = () => {
    const parsed = safeParsePerubahanDataPribadi({
      perubahan: changedValues,
      alasan,
    });
    if (changes.length === 0) {
      setErrors([
        'Belum ada field yang diubah. Silakan ubah minimal satu data terlebih dahulu.',
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
    const parsed = safeParsePerubahanDataPribadi({
      perubahan: changedValues,
      alasan,
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setStep(2);
      return;
    }

    try {
      const result = await mutation.mutateAsync({
        perubahan: changedValues,
        alasan,
      });
      const isSaved = result.status === 'tersimpan';
      setLastResult({
        nama: member?.nama_anggota || 'anggota',
        status: result.status,
      });
      showToast(
        isSaved
          ? 'Perubahan data pribadi berhasil disimpan'
          : 'Usulan dikirim — menunggu persetujuan admin',
        isSaved ? 'success' : 'info',
      );

      // Kembali ke langkah awal untuk proses berikutnya.
      setStep(1);
      setMember(null);
      setValues({});
      setAlasan('');
      setErrors([]);
    } catch (error: any) {
      showToast(`Gagal menyimpan: ${getErrorMessage(error)}`, 'error');
    }
  };

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Perubahan Data Pribadi"
            description="Ubah data pribadi anggota (alamat, kontak, dokumen, bank, dan lainnya)"
          />
        </Toolbar>
      </Container>

      <Container>
        <div className="grid gap-5 lg:gap-7.5">
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
            <Alert
              variant={lastResult.status === 'tersimpan' ? 'success' : 'info'}
            >
              <CheckCircle2 className="size-5" />
              <AlertTitle>
                {lastResult.status === 'tersimpan'
                  ? `Perubahan tersimpan — ${lastResult.nama}`
                  : `Usulan terkirim — ${lastResult.nama} menunggu persetujuan admin`}
              </AlertTitle>
              <AlertDescription>
                {lastResult.status === 'tersimpan'
                  ? 'Perubahan data pribadi telah disimpan ke data utama anggota.'
                  : 'Data utama belum berubah sampai usulan disetujui oleh admin.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Pesan error validasi */}
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
                  <strong>nama</strong>. NIK berfungsi sebagai nomor anggota.
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
                    Data pribadi: tempat/tanggal lahir, jenis kelamin, agama,
                    alamat, kontak, nomor dokumen (E-KTP, KK, NPWP), BPJS, dan
                    bantuan sosial. Perubahan rekening bank dilakukan lewat menu{' '}
                    <strong>Penggantian Rekening</strong>. Data cabang, status
                    keanggotaan, kematian, dan NIK <strong>tidak</strong> dapat
                    diubah di sini — gunakan menu masing-masing.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Langkah 2 — Informasi & Ubah Data */}
          {step === 2 && member && (
            <Fragment>
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserRoundPen className="size-5" />
                      Informasi Anggota
                    </CardTitle>
                    <CardDescription>
                      Data identitas inti bersifat read-only. Perubahan data
                      dilakukan pada formulir di bawah.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStep(1);
                      setMember(null);
                      setValues({});
                      setAlasan('');
                      setErrors([]);
                    }}
                  >
                    Ganti Anggota
                  </Button>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">NIK</dt>
                      <dd className="font-mono text-sm font-medium">
                        {member.nik}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Nama Lengkap
                      </dt>
                      <dd className="text-sm font-medium">
                        {member.nama_anggota}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Cabang</dt>
                      <dd className="text-sm font-medium">
                        {member.nama_cabang}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {member.status_anggota}
                        </Badge>
                        <Badge variant="success">
                          {member.kategori_anggota}
                        </Badge>
                        {member.status_keanggotaan && (
                          <Badge
                            variant={
                              member.status_keanggotaan === 'berhenti'
                                ? 'destructive'
                                : 'info'
                            }
                          >
                            {member.status_keanggotaan}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </dl>

                  {(member.status_anggota === 'meninggal' ||
                    member.status_keanggotaan === 'berhenti') && (
                    <Alert variant="warning" className="mt-4">
                      <AlertTitle>Perhatian</AlertTitle>
                      <AlertDescription>
                        {member.status_anggota === 'meninggal'
                          ? 'Anggota berstatus meninggal. Perubahan data pribadi tetap dapat dicatat untuk keperluan arsip.'
                          : 'Keanggotaan anggota telah berakhir. Perubahan data pribadi tetap dapat dicatat untuk keperluan arsip.'}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Formulir Perubahan Data Pribadi</CardTitle>
                  <CardDescription>
                    Ubah hanya field yang perlu diperbarui. Ringkasan perubahan
                    akan ditampilkan sebelum disimpan.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PerubahanDataPribadiForm
                    member={member}
                    values={values}
                    onChange={setValues}
                    isPending={mutation.isPending}
                    onSubmit={goToReview}
                    footer={
                      <div className="flex flex-col-reverse gap-2.5 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleReset}
                          disabled={mutation.isPending}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Reset Perubahan
                        </Button>
                        <Button
                          type="submit"
                          disabled={mutation.isPending || changes.length === 0}
                        >
                          Tinjau Perubahan ({changes.length})
                        </Button>
                      </div>
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
                  Periksa perbandingan data lama dan baru. Tanda &quot;—&quot;
                  berarti nilai kosong.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldDiffTable changes={changes} />

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Alasan Perubahan <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="Contoh: pindah alamat domisili per Januari 2026"
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
                        Simpan Perubahan
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
      </Container>

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
    </Fragment>
  );
}

export default function PerubahanDataPribadiPage() {
  return (
    <ProtectedRoute permission={PERMISSIONS.MANAGE_KEANGGOTAAN}>
      <PerubahanDataPribadiContent />
    </ProtectedRoute>
  );
}
