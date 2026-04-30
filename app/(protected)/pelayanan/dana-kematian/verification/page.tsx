'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { Container } from '@/components/common/container';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, ShieldAlert, Shield } from 'lucide-react';
import { DanaKematian } from '@/lib/supabase';
import { PPVerificationPanel } from '@/components/dana-kematian/PPVerificationPanel';
import { useDanaKematian } from '@/lib/hooks/use-dana-kematian-api';
import { ToastNotification } from '@/components/anggota/ToastNotification';
import { useCanAccessPPVerification } from '@/lib/hooks/use-user-permissions';
import { canVerifyPP } from '@/lib/permissions/dana-kematian';

interface VerificationPageProps {
  params: Promise<{ id: string }>;
}

export default function VerificationPage({ params }: VerificationPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  });

  const { data: claim, isLoading, error } = useDanaKematian(id);
  const { canAccess, isLoading: permissionLoading, role, roleName } = useCanAccessPPVerification();

  // Check access on mount
  useEffect(() => {
    if (!permissionLoading && !canAccess) {
      // Show access denied message inline
    }
  }, [canAccess, permissionLoading]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Check if user can verify this specific claim based on amount
  const verifyPermission = claim ? canVerifyPP(role, claim.besaran_dana_kematian) : null;

  const handleVerificationComplete = async (result: any) => {
    try {
      // Check if approval needed for Ketua II
      if (role === 'ketua_ii' && verifyPermission?.needsApproval) {
        // Request approval from Ketua I
        const approvalResponse = await fetch('/api/dana-kematian/[id]/request-approval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claimId: id,
            requestedBy: role,
            amount: claim.besaran_dana_kematian,
            reason: 'Amount exceeds Rp 100 juta'
          })
        });

        if (!approvalResponse.ok) {
          showToast('Gagal request approval', 'error');
          return;
        }
      }

      const response = await fetch(`/api/dana-kematian/${id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...result,
          verifiedBy: roleName,
          verifiedAt: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete verification');
      }

      const data = await response.json();

      if (data.success) {
        showToast(data.message, 'success');
        setTimeout(() => {
          router.push('/keuangan/dana-kematian');
        }, 2000);
      } else {
        showToast(data.error || 'Verification failed', 'error');
      }
    } catch (error) {
      console.error('Error completing verification:', error);
      showToast('Gagal menyelesaikan verifikasi', 'error');
    }
  };

  if (isLoading || permissionLoading) {
    return (
      <Container>
        <Toolbar>
          <ToolbarHeading title="Verifikasi Dana Kematian" description="Memuat data..." />
          <ToolbarActions />
        </Toolbar>
        <Container className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Memuat data dan memeriksa akses...</p>
          </div>
        </Container>
      </Container>
    );
  }

  // Show access denied if not authorized
  if (!canAccess && !permissionLoading) {
    return (
      <Container>
        <Toolbar>
          <ToolbarHeading title="Verifikasi Dana Kematian" description="Akses Ditolak" />
          <ToolbarActions />
        </Toolbar>
        <Container className="flex items-center justify-center min-h-[50vh]">
          <Card className="max-w-2xl p-8 text-center">
            <ShieldAlert className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Akses Ditolak</h2>
            <p className="text-muted-foreground mb-6">
              Maaf, halaman verifikasi Dana Kematian hanya dapat diakses oleh user dengan role tertentu.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                <p className="font-semibold text-red-900 mb-2">Role yang Diizinkan:</p>
                <ul className="text-sm text-red-800 space-y-1">
                  <li>• <strong>Ketua I</strong> - Full access verifikasi</li>
                  <li>• <strong>Ketua II</strong> - Verifikasi dengan approval untuk amount > Rp 100 juta</li>
                  <li>• <strong>Administrator</strong> - Full access sistem</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <p className="font-semibold text-blue-900 mb-2">Informasi Role Anda:</p>
                <p className="text-sm text-blue-800">
                  <strong>{roleName || role}</strong>
                  {role === 'ketua_ii' && (
                    <p className="text-xs mt-1">
                      Dapat verifikasi, tapi memerlukan approval Ketua I untuk amount > Rp 100 juta
                    </p>
                  )}
                  {role === 'pc_staff' && (
                    <p className="text-xs mt-1">
                      Role PC tidak dapat mengakses verifikasi PP
                    </p>
                  )}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left">
              <p className="font-semibold text-gray-900 mb-2">Prosedur untuk Mendapatkan Akses:</p>
              <ol className="text-sm text-gray-800 space-y-1 list-decimal list-inside">
                <li>Hubungi Administrator sistem</li>
                <li>Request role upgrade ke Ketua I atau Ketua II</li>
                <li>Administrator akan mengubah role Anda</li>
                <li>Refresh halaman ini setelah role diperbarui</li>
              </ol>
            </div>

            <div className="flex gap-2 justify-center">
              <Button onClick={() => router.back()} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
              <Button onClick={() => router.push('/pelayanan/dana-kematian')}>
                Lihat Daftar Pengajuan
              </Button>
            </div>
          </Card>
        </Container>
      </Container>
    );
  }

  if (error || !claim) {
    return (
      <Container>
        <Toolbar>
          <ToolbarHeading title="Verifikasi Dana Kematian" description="Data tidak ditemukan" />
          <ToolbarActions />
        </Toolbar>
        <Container className="flex items-center justify-center min-h-[50vh]">
          <Card className="max-w-md p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Data Tidak Ditemukan</h2>
            <p className="text-muted-foreground mb-4">
              Pengajuan dana kematian tidak ditemukan atau telah dihapus.
            </p>
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </Card>
        </Container>
      </Container>
    );
  }

  // Check if claim is in correct status for verification
  const canVerify = claim.status_proses === 'proses_pusat' || claim.status_proses === 'verifikasi_cabang';
  const isAlreadyProcessed = claim.status_proses === 'verified' || claim.status_proses === 'ditolak';

  return (
    <Container>
      <Toolbar>
        <ToolbarHeading
          title="Verifikasi Dana Kematian"
          description="Proses verifikasi pengajuan dari PC"
        />
        <ToolbarActions />
      </Toolbar>

      <Container>
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">Verifikasi Pengajuan</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  ID: {id} • Dari PC: {claim.cabang_asal_melapor}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={
                  claim.status_proses === 'verified' ? 'success' :
                  claim.status_proses === 'ditolak' ? 'destructive' :
                  'secondary'
                }>
                  {claim.status_proses === 'verified' && 'Terverifikasi'}
                  {claim.status_proses === 'ditolak' && 'Ditolak'}
                  {claim.status_proses === 'proses_pusat' && 'Dalam Verifikasi'}
                </Badge>

                {/* Role badge */}
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  {roleName}
                </Badge>
              </div>
            </div>

            {/* Quick Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Nama Anggota</div>
                <div className="font-medium">{claim.nama_anggota}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Ahli Waris</div>
                <div className="font-medium">{claim.nama_ahli_waris}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Tanggal Meninggal</div>
                <div className="font-medium">
                  {new Date(claim.tanggal_meninggal).toLocaleDateString('id-ID')}
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-700 mb-1">Dana Kematian</div>
                <div className="font-bold text-green-700">
                  {new Intl.NumberFormat('id-ID').format(claim.besaran_dana_kematian)}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Status Warning */}
        {isAlreadyProcessed && (
          <Card className={`p-4 mb-6 ${
            claim.status_proses === 'verified' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              {claim.status_proses === 'verified' ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              )}
              <div>
                <h3 className={`font-semibold ${
                  claim.status_proses === 'verified' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {claim.status_proses === 'verified' ? 'Sudah Diverifikasi' : 'Sudah Ditolak'}
                </h3>
                <p className={`text-sm ${
                  claim.status_proses === 'verified' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {claim.status_proses === 'verified'
                    ? `Pengajuan ini telah disetujui pada ${claim.waktu_3 && new Date(claim.waktu_3).toLocaleDateString('id-ID')}`
                    : `Pengajuan ini telah ditolak. Alasan: ${claim.rejection_reason || 'Tidak dicatat'}`
                  }
                </p>
              </div>
            </div>
          </Card>
        )}

        {!canVerify && !isAlreadyProcessed && (
          <Card className="p-4 mb-6 bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-900">Status Tidak Sesuai</h3>
                <p className="text-sm text-yellow-800">
                  Pengajuan ini tidak dalam status verifikasi. Status saat ini: {claim.status_proses}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Approval Requirement for Ketua II */}
        {canVerify && verifyPermission?.needsApproval && !isAlreadyProcessed && (
          <Card className="p-4 mb-6 bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900">Memerlukan Approval Ketua I</h3>
                <p className="text-sm text-yellow-800 mt-1">
                  Besaran dana kematian <strong>Rp {new Intl.NumberFormat('id-ID').format(claim.besaran_dana_kematian)}</strong> melebihi Rp 100 juta.
                  Sebagai <strong>Ketua II</strong>, Anda perlu mendapatkan approval dari Ketua I sebelum dapat menyetujui pengajuan ini.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => showToast('Fitur request approval akan segera tersedia', 'info')}
                >
                  Request Approval
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Verification Panel */}
        {canAccess && (
          <PPVerificationPanel
            claim={claim}
            onVerificationComplete={handleVerificationComplete}
            readonly={isAlreadyProcessed || !canVerify}
            requiresApproval={verifyPermission?.needsApproval}
          />
        )}
      </Container>

      {/* Toast Notification */}
      <ToastNotification
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </Container>
  );
}