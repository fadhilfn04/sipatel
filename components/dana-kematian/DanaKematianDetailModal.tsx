import { User, FileText, Calendar, MapPin, Phone, DollarSign, Building, CheckCircle, X, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DanaKematian } from '@/lib/supabase';
import { DanaKematianTimeline, DanaKematianTimelineProgress } from './DanaKematianTimeline';
import { CommunicationTrackingPanel } from './CommunicationTrackingPanel';
import { DocumentValidationSystem } from './DocumentValidationSystem';
import { ReportGenerationSystem } from './ReportGenerationSystem';
import { allowsCommunicationTracking, allowsDocumentUpload, allowsReporting } from '@/lib/workflow/dana-kematian-state-machine';
import { useCanAccessPPVerification } from '@/lib/hooks/use-user-permissions';
import { useUpdateDanaKematian } from '@/lib/hooks/use-dana-kematian-api';
import { useState } from 'react';
import { ToastNotification } from '@/components/anggota/ToastNotification';

interface DanaKematianDetailModalProps {
  open: boolean;
  onClose: () => void;
  claim: DanaKematian | null;
  onRefresh?: () => void;
}

interface StatusProps {
  variant: 'success' | 'warning' | 'destructive' | 'secondary';
  label: string;
}

export function DanaKematianDetailModal({ open, onClose, claim, onRefresh }: DanaKematianDetailModalProps) {
  const { canAccess, isLoading: permissionLoading, role, roleName } = useCanAccessPPVerification();
  const updateMutation = useUpdateDanaKematian(claim?.id || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Check if all required documents are verified
  const allRequiredDocsVerified = claim ? (
    claim.dokumen_surat_kematian_verified &&
    claim.dokumen_sk_pensiun_verified &&
    claim.dokumen_surat_pernyataan_verified &&
    claim.dokumen_kartu_keluarga_verified &&
    claim.dokumen_ktp_ahli_waris_verified
  ) : false;

  const canShowVerifyButton = claim ? (
    !permissionLoading &&
    canAccess &&
    claim.status_proses === 'verifikasi_cabang' &&
    allRequiredDocsVerified
  ) : false;

  const canShowFinalizeButton = claim ? (
    !permissionLoading &&
    canAccess &&
    claim.status_proses === 'proses_pusat' &&
    allRequiredDocsVerified
  ) : false;

  // Debug logging
  useEffect(() => {
    if (!claim) return;

    console.log('[DanaKematianDetailModal] Permission Check:', {
      claimStatus: claim?.status_proses,
      canAccess,
      permissionLoading,
      role,
      roleName,
      allRequiredDocsVerified,
      canShowVerifyButton,
      canShowFinalizeButton
    });
  }, [claim, canAccess, permissionLoading, role, roleName, allRequiredDocsVerified, canShowVerifyButton, canShowFinalizeButton]);

  if (!claim) return null;

  const handleVerifyAndSendToPusat = async () => {
    if (!claim) return;

    try {
      setIsVerifying(true);

      console.log('[handleVerifyAndSendToPusat] Starting update...');
      console.log('[handleVerifyAndSendToPusat] Current status:', claim.status_proses);

      // Update status to proses_pusat
      const result = await updateMutation.mutateAsync({
        status_proses: 'proses_pusat',
        cabang_tanggal_kirim_ke_pusat: new Date().toISOString().split('T')[0],
        pusat_tanggal_awal_terima: new Date().toISOString().split('T')[0],
      } as any);

      console.log('[handleVerifyAndSendToPusat] Update result:', result);

      // Check if update was successful
      if (result && !updateMutation.error) {
        console.log('[handleVerifyAndSendToPusat] Update successful!');

        // Refresh data
        if (onRefresh) {
          onRefresh();
        }

        // Close modal
        onClose();

        // Show success message then redirect
        showToast('Status berhasil diubah ke Proses Pusat', 'success');

        setTimeout(() => {
          console.log('[handleVerifyAndSendToPusat] Redirecting to list page...');
          window.location.href = '/pelayanan/dana-kematian';
        }, 1000);
      } else {
        throw new Error(updateMutation.error || 'Update failed');
      }
    } catch (error) {
      console.error('[handleVerifyAndSendToPusat] Error:', error);
      setIsVerifying(false);
      // Show error to user
      const errorMessage = error instanceof Error ? error.message : 'Gagal mengirim ke pusat';
      showToast(errorMessage, 'error');
    }
  };

  const handleFinalize = async () => {
    if (!claim) return;

    try {
      setIsFinalizing(true);

      console.log('[handleFinalize] Starting finalization...');
      console.log('[handleFinalize] Current status:', claim.status_proses);

      // Update status to verified
      const result = await updateMutation.mutateAsync({
        status_proses: 'verified',
        waktu_3: new Date().toISOString(),
      } as any);

      console.log('[handleFinalize] Finalization result:', result);

      // Check if update was successful
      if (result && !updateMutation.error) {
        console.log('[handleFinalize] Finalization successful!');

        // Refresh data
        if (onRefresh) {
          onRefresh();
        }

        // Close modal
        onClose();

        // Show success message then redirect
        showToast('Pengajuan berhasil difinalisasi dan disetujui', 'success');

        setTimeout(() => {
          console.log('[handleFinalize] Redirecting to list page...');
          window.location.href = '/pelayanan/dana-kematian';
        }, 1000);
      } else {
        throw new Error(updateMutation.error || 'Finalization failed');
      }
    } catch (error) {
      console.error('[handleFinalize] Error:', error);
      setIsFinalizing(false);
      // Show error to user
      const errorMessage = error instanceof Error ? error.message : 'Gagal memfinalisasi pengajuan';
      showToast(errorMessage, 'error');
    }
  };

  const getStatusProsesProps = (status: DanaKematian['status_proses']): StatusProps => {
    switch (status) {
      case 'dilaporkan':
        return { variant: 'secondary', label: 'Dilaporkan' };
      case 'verifikasi_cabang':
        return { variant: 'warning', label: 'Verifikasi Cabang' };
      case 'pending_dokumen':
        return { variant: 'warning', label: 'Pending Dokumen' };
      case 'proses_pusat':
        return { variant: 'warning', label: 'Proses Pusat' };
      case 'verified':
        return { variant: 'success', label: 'Terverifikasi' };
      case 'penyaluran':
        return { variant: 'warning', label: 'Penyaluran' };
      case 'selesai':
        return { variant: 'success', label: 'Selesai' };
      case 'ditolak':
        return { variant: 'destructive', label: 'Ditolak' };
      default:
        return { variant: 'secondary', label: status };
    }
  };

  const getAhliWarisLabel = (status: DanaKematian['status_ahli_waris']) => {
    const statusMap: Record<string, string> = {
      istri: 'Istri',
      suami: 'Suami',
      anak: 'Anak',
      keluarga: 'Keluarga',
    };
    return statusMap[status] || status;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Detail Dana Kematian</DialogTitle>
          <DialogDescription>
            Informasi lengkap mengenai pengajuan dana kematian
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <Badge variant={getStatusProsesProps(claim.status_proses).variant} appearance="ghost">
                <BadgeDot />
                {getStatusProsesProps(claim.status_proses).label}
              </Badge>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Nama Anggota</div>
              <div className="font-medium text-sm">{claim.nama_anggota}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Ahli Waris</div>
              <div className="font-medium text-sm">{claim.nama_ahli_waris}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Besaran Dana</div>
              <div className="font-semibold text-green-600">{formatCurrency(claim.besaran_dana_kematian)}</div>
            </div>
          </div>

          {/* Tabs for different sections */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Detail</TabsTrigger>
              <TabsTrigger value="timeline">Waktu</TabsTrigger>
              <TabsTrigger value="documents">Dokumen</TabsTrigger>
              <TabsTrigger value="communication">Komunikasi</TabsTrigger>
              <TabsTrigger value="reports">Laporan</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Timeline Progress */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <DanaKematianTimelineProgress claim={claim} />
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-semibold">Informasi Anggota</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Nama:</span>
                      <span>{claim.nama_anggota}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Status MPS:</span>
                      <Badge variant="secondary">{claim.status_mps}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Tanggal Meninggal:</span>
                      <span>{formatDate(claim.tanggal_meninggal)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Informasi Ahli Waris</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Nama:</span>
                      <span>{claim.nama_ahli_waris}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Status:</span>
                      <Badge variant="secondary">{getAhliWarisLabel(claim.status_ahli_waris)}</Badge>
                    </div>
                    {claim.no_hp_ahli_waris && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">No. HP:</span>
                        <span>{claim.no_hp_ahli_waris}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Information */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-green-900">Besaran Dana Kematian</h3>
                    <p className="text-sm text-green-700">Jumlah yang disetujui untuk ahli waris</p>
                  </div>
                  <div className="text-2xl font-bold text-green-700">
                    {formatCurrency(claim.besaran_dana_kematian)}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <DanaKematianTimeline claim={claim} showLabels={true} />
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <DocumentValidationSystem
                claim={claim}
                readonly={!canAccess}
                onUpdate={canAccess && claim.status_proses === 'verifikasi_cabang' ? (updates) => {
                  // Update claim when document verification changes
                  updateMutation.mutateAsync(updates as any).catch(console.error);
                } : undefined}
              />
            </TabsContent>

            <TabsContent value="communication" className="space-y-4">
              {allowsCommunicationTracking(claim.status_proses) ? (
                <CommunicationTrackingPanel
                  claim={claim}
                  readonly={true}
                />
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    Komunikasi tracking hanya tersedia untuk status: Dilaporkan, Verifikasi Cabang
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Status saat ini: {getStatusProsesProps(claim.status_proses).label}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              {allowsReporting(claim.status_proses) || claim.file_berita_acara ? (
                <ReportGenerationSystem
                  claim={claim}
                  readonly={true}
                />
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    Laporan hanya dapat dibuat pada tahap penyaluran dana
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Status saat ini: {getStatusProsesProps(claim.status_proses).label}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogBody>

        <DialogFooter className="flex justify-between">
          <div className="flex-1 flex gap-2">
            {canShowVerifyButton && (
              <Button
                onClick={handleVerifyAndSendToPusat}
                disabled={isVerifying}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Verifikasi & Kirim ke Pusat
                  </>
                )}
              </Button>
            )}
            {canShowFinalizeButton && (
              <Button
                onClick={handleFinalize}
                disabled={isFinalizing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isFinalizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Finalisasi & Setujui
                  </>
                )}
              </Button>
            )}
          </div>
          <DialogClose asChild>
            <Button variant="outline">Tutup</Button>
          </DialogClose>
        </DialogFooter>

        {/* Toast Notification */}
        <ToastNotification
          show={toast.show}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      </DialogContent>
    </Dialog>
  );
}
