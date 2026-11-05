'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Toolbar, ToolbarHeading } from '@/layouts/demo1/toolbar';
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  RotateCcw,
  UserPlus,
} from 'lucide-react';
import { useCreateAnggota } from '@/lib/hooks/use-anggota-api';
import { PERMISSIONS } from '@/lib/rbac';
import { CreateAnggotaInput } from '@/lib/supabase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MemberForm } from '@/components/anggota/MemberForm';
import { ToastNotification } from '@/components/anggota/ToastNotification';
import { Container } from '@/components/common/container';
import { ProtectedRoute } from '@/components/rbac/protected-route';

interface RegistrationResult {
  nama: string;
  status: 'tersimpan' | 'menunggu';
}

function getErrorMessage(error: any) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Terjadi kesalahan'
  );
}

function PendaftaranAnggotaBaruContent() {
  const createMutation = useCreateAnggota();

  // Counter untuk me-reset form setelah pendaftaran berhasil / tombol reset.
  const [formResetKey, setFormResetKey] = useState(0);
  const [lastResult, setLastResult] = useState<RegistrationResult | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

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

  // Alur submit identik dengan fitur Tambah Anggota pada Pengelolaan Data:
  // admin → langsung tersimpan, non-admin → usulan menunggu approval.
  const handleCreate = async (data: CreateAnggotaInput) => {
    try {
      const result: any = await createMutation.mutateAsync(data);
      if (result?.status === 'menunggu') {
        showToast(
          result.message ||
            'Usulan penambahan anggota menunggu persetujuan admin.',
          'info',
        );
        setLastResult({ nama: data.nama_anggota, status: 'menunggu' });
      } else {
        showToast('Anggota baru berhasil ditambahkan', 'success');
        setLastResult({ nama: data.nama_anggota, status: 'tersimpan' });
      }

      // Siapkan formulir kosong untuk pendaftaran anggota berikutnya.
      setFormResetKey((key) => key + 1);
    } catch (error: any) {
      console.error('Error creating member:', error);
      // Data yang sudah diisi dipertahankan agar dapat diperbaiki.
      showToast(
        `Gagal menambahkan anggota: ${getErrorMessage(error)}`,
        'error',
      );
      throw error;
    }
  };

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Pendaftaran Anggota Baru"
            description="Formulir pendaftaran anggota pensiunan baru"
          />
        </Toolbar>
      </Container>

      <Container>
        <div className="grid gap-5 lg:gap-7.5">
          {lastResult && (
            <Alert
              variant={lastResult.status === 'tersimpan' ? 'success' : 'info'}
            >
              <CheckCircle2 className="size-5" />
              <AlertTitle>
                {lastResult.status === 'tersimpan'
                  ? `Pendaftaran berhasil — ${lastResult.nama} tersimpan`
                  : `Usulan terkirim — ${lastResult.nama} menunggu persetujuan admin`}
              </AlertTitle>
              <AlertDescription>
                Formulir telah dikosongkan. Silakan lanjutkan mendaftarkan
                anggota berikutnya atau periksa hasilnya pada menu Pengelolaan
                Data.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="size-5" />
                Formulir Pendaftaran Anggota
              </CardTitle>
              <CardDescription>
                Lengkapi data calon anggota di bawah ini. Field bertanda * wajib
                diisi. Sistem otomatis memeriksa duplikasi NIK sebelum data
                disimpan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MemberForm
                mode="create"
                isPending={createMutation.isPending}
                onSubmit={handleCreate}
                resetKey={formResetKey}
                footer={
                  <div className="flex flex-col-reverse gap-2.5 pt-5 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={createMutation.isPending}
                      onClick={() => setFormResetKey((key) => key + 1)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset Formulir
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Simpan Anggota
                        </>
                      )}
                    </Button>
                  </div>
                }
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/keanggotaan/pengelolaan-data">
                <ClipboardList className="h-4 w-4 mr-2" />
                Lihat Data di Pengelolaan Data
              </Link>
            </Button>
          </div>
        </div>
      </Container>

      <ToastNotification
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ show: false, message: '', type: 'success' })}
      />
    </Fragment>
  );
}

export default function PendaftaranAnggotaBaruPage() {
  return (
    <ProtectedRoute permission={PERMISSIONS.MANAGE_KEANGGOTAAN}>
      <PendaftaranAnggotaBaruContent />
    </ProtectedRoute>
  );
}
