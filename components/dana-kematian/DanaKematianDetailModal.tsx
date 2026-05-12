'use client';

import { useState } from 'react';
import {
  User,
  FileText,
  Calendar,
  Building,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Clock,
  Banknote,
  Phone,
  AlertTriangle,
  Send,
  CreditCard,
} from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DanaKematian } from '@/lib/supabase';
import { DanaKematianTimeline, DanaKematianTimelineProgress } from './DanaKematianTimeline';
import { DocumentValidationSystem } from './DocumentValidationSystem';
import { ReportGenerationSystem } from './ReportGenerationSystem';
import { allowsReporting } from '@/lib/workflow/dana-kematian-state-machine';
import { useUserPermissions } from '@/lib/hooks/use-user-permissions';
import { useUpdateDanaKematian, useDanaKematian } from '@/lib/hooks/use-dana-kematian-api';
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
  color: string;
}

export function DanaKematianDetailModal({ open, onClose, claim, onRefresh }: DanaKematianDetailModalProps) {
  const { canVerifyPP, canManagePC, canAccessKeuangan, isLoading: permissionLoading } = useUserPermissions();

  // Live data — auto-refreshes when mutation invalidates the query
  const { data: freshClaim } = useDanaKematian(claim?.id || '');
  const activeClaim = freshClaim ?? claim;

  const updateMutation = useUpdateDanaKematian(activeClaim?.id || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPusatApproving, setIsPusatApproving] = useState(false);
  const [isKeuanganApproving, setIsKeuanganApproving] = useState(false);
  const [isConfirmingTransfer, setIsConfirmingTransfer] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3500);
  };

  if (!activeClaim) return null;

  const requiredDocsUploaded =
    !!activeClaim.file_surat_kematian &&
    !!activeClaim.file_sk_pensiun &&
    !!activeClaim.file_surat_pernyataan_ahli_waris &&
    !!activeClaim.file_kartu_keluarga &&
    !!activeClaim.file_e_ktp;

  const allRequiredDocsVerified =
    !!activeClaim.dokumen_surat_kematian_verified &&
    !!activeClaim.dokumen_sk_pensiun_verified &&
    !!activeClaim.dokumen_surat_pernyataan_verified &&
    !!activeClaim.dokumen_kartu_keluarga_verified &&
    !!activeClaim.dokumen_ktp_ahli_waris_verified;

  // Step 1: Cabang submits to Pusat
  const canSubmitToPusat =
    !permissionLoading &&
    canManagePC &&
    activeClaim.status_proses === 'dilaporkan' &&
    requiredDocsUploaded;

  // Step 2: Pusat verifies docs and approves
  const canPusatApprove =
    !permissionLoading &&
    canVerifyPP &&
    activeClaim.status_proses === 'proses_pusat' &&
    allRequiredDocsVerified;

  // Step 3: Keuangan approves penyaluran
  const canKeuanganApprove =
    !permissionLoading &&
    canAccessKeuangan &&
    activeClaim.status_proses === 'verified';

  // Step 4: Pusat confirms transfer (selesai)
  const canConfirmTransfer =
    !permissionLoading &&
    canVerifyPP &&
    activeClaim.status_proses === 'penyaluran';

  // Document validation editable when Pusat and status is proses_pusat
  const canEditDocuments =
    canVerifyPP && activeClaim.status_proses === 'proses_pusat';

  const handleSubmitToPusat = async () => {
    try {
      setIsSubmitting(true);
      await updateMutation.mutateAsync({
        status_proses: 'proses_pusat',
        cabang_tanggal_kirim_ke_pusat: new Date().toISOString().split('T')[0],
      } as any);
      onRefresh?.();
      showToast('Pengajuan berhasil dikirim ke Pusat', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengirim ke Pusat', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePusatApprove = async () => {
    try {
      setIsPusatApproving(true);
      await updateMutation.mutateAsync({
        status_proses: 'verified',
        pusat_tanggal_validasi: new Date().toISOString().split('T')[0],
        waktu_3: new Date().toISOString(),
      } as any);
      onRefresh?.();
      showToast('Pengajuan berhasil disetujui oleh Pusat', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyetujui pengajuan', 'error');
    } finally {
      setIsPusatApproving(false);
    }
  };

  const handleKeuanganApprove = async () => {
    try {
      setIsKeuanganApproving(true);
      await updateMutation.mutateAsync({
        status_proses: 'penyaluran',
        waktu_4: new Date().toISOString(),
      } as any);
      onRefresh?.();
      showToast('Penyaluran dana telah disetujui oleh Keuangan', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyetujui penyaluran', 'error');
    } finally {
      setIsKeuanganApproving(false);
    }
  };

  const handleConfirmTransfer = async () => {
    try {
      setIsConfirmingTransfer(true);
      await updateMutation.mutateAsync({
        status_proses: 'selesai',
        pusat_tanggal_selesai: new Date().toISOString().split('T')[0],
        waktu_7: new Date().toISOString(),
      } as any);
      onRefresh?.();
      showToast('Transfer dana telah dikonfirmasi. Pengajuan selesai.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengkonfirmasi transfer', 'error');
    } finally {
      setIsConfirmingTransfer(false);
    }
  };

  const getStatusProps = (status: DanaKematian['status_proses']): StatusProps => {
    const map: Record<string, StatusProps> = {
      dilaporkan:        { variant: 'secondary',   label: 'Dilaporkan',        color: 'text-gray-600' },
      verifikasi_cabang: { variant: 'warning',     label: 'Verifikasi Cabang', color: 'text-amber-600' },
      pending_dokumen:   { variant: 'warning',     label: 'Pending Dokumen',   color: 'text-amber-600' },
      proses_pusat:      { variant: 'warning',     label: 'Proses Pusat',      color: 'text-blue-600' },
      verified:          { variant: 'success',     label: 'Terverifikasi',     color: 'text-green-600' },
      penyaluran:        { variant: 'warning',     label: 'Penyaluran',        color: 'text-purple-600' },
      selesai:           { variant: 'success',     label: 'Selesai',           color: 'text-green-700' },
      ditolak:           { variant: 'destructive', label: 'Ditolak',           color: 'text-red-600' },
    };
    return map[status] ?? { variant: 'secondary', label: status, color: 'text-gray-600' };
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const statusProps = getStatusProps(activeClaim.status_proses);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-[100vw] max-h-screen p-0 gap-0 overflow-hidden flex flex-col rounded-none">

        {/* Header */}
        <div className="shrink-0 bg-linear-to-r from-slate-800 to-slate-700 text-white px-8 py-5">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wide mb-1">
                  <FileText className="h-3.5 w-3.5" />
                  Detail Pengajuan Dana Kematian
                </div>
                <DialogTitle className="text-white text-2xl font-bold">
                  {activeClaim.nama_anggota}
                </DialogTitle>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant={statusProps.variant} appearance="ghost" className="bg-white/10 border-white/20 text-white">
                    <BadgeDot />
                    {statusProps.label}
                  </Badge>
                  <span className="text-slate-300 text-sm flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(activeClaim.tanggal_meninggal)}
                  </span>
                  <span className="text-slate-300 text-sm flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5" />
                    {activeClaim.cabang_asal_melapor}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-slate-400 text-xs mb-1">Besaran Dana</div>
                <div className="text-2xl font-bold text-green-400">
                  {formatCurrency(activeClaim.besaran_dana_kematian)}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="shrink-0 w-full rounded-none border-b bg-background h-11 grid grid-cols-4 px-8 gap-0 justify-start">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Detail
              </TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Timeline
              </TabsTrigger>
              <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Dokumen
              </TabsTrigger>
              <TabsTrigger value="reports" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Laporan
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">

                {/* ── Detail Tab ── */}
                <TabsContent value="overview" className="mt-0 space-y-6">
                  {/* Progress bar */}
                  <div className="border rounded-xl p-4 bg-muted/30">
                    <DanaKematianTimelineProgress claim={activeClaim} />
                  </div>

                  {/* Workflow status banner */}
                  <WorkflowStatusBanner status={activeClaim.status_proses} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Member */}
                    <div className="border rounded-xl p-5 space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                        <User className="h-4 w-4" /> Informasi Anggota
                      </h3>
                      <InfoRow label="Nama Anggota" value={activeClaim.nama_anggota} />
                      <InfoRow label="Status Anggota" value={<Badge variant="secondary">{activeClaim.status_anggota}</Badge>} />
                      <InfoRow label="Status MPS" value={<Badge variant="outline">{activeClaim.status_mps}</Badge>} />
                      <InfoRow label="Tanggal Meninggal" value={formatDate(activeClaim.tanggal_meninggal)} />
                      {activeClaim.penyebab_meninggal && (
                        <InfoRow label="Penyebab Meninggal" value={activeClaim.penyebab_meninggal} />
                      )}
                    </div>

                    {/* Ahli Waris */}
                    <div className="border rounded-xl p-5 space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                        <User className="h-4 w-4" /> Ahli Waris
                      </h3>
                      <InfoRow label="Nama" value={activeClaim.nama_ahli_waris} />
                      <InfoRow label="Status" value={<Badge variant="secondary">{activeClaim.status_ahli_waris}</Badge>} />
                      {activeClaim.no_hp_ahli_waris && (
                        <InfoRow label="No. HP" value={
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" />
                            {activeClaim.no_hp_ahli_waris}
                          </span>
                        } />
                      )}
                      {activeClaim.nik_ahli_waris && (
                        <InfoRow label="NIK" value={activeClaim.nik_ahli_waris} />
                      )}
                      {activeClaim.alamat_ahli_waris && (
                        <InfoRow label="Alamat" value={activeClaim.alamat_ahli_waris} />
                      )}
                    </div>

                    {/* Pelaporan */}
                    <div className="border rounded-xl p-5 space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                        <Building className="h-4 w-4" /> Pelaporan
                      </h3>
                      <InfoRow label="Cabang Pelapor" value={activeClaim.cabang_asal_melapor} />
                      {activeClaim.cabang_nama_pelapor && (
                        <InfoRow label="Nama Pelapor" value={activeClaim.cabang_nama_pelapor} />
                      )}
                      {activeClaim.cabang_nik_pelapor && (
                        <InfoRow label="NIK Pelapor" value={activeClaim.cabang_nik_pelapor} />
                      )}
                      {activeClaim.tanggal_lapor_keluarga && (
                        <InfoRow label="Tanggal Lapor Keluarga" value={formatDate(activeClaim.tanggal_lapor_keluarga)} />
                      )}
                      {activeClaim.cabang_tanggal_kirim_ke_pusat && (
                        <InfoRow label="Dikirim ke Pusat" value={formatDate(activeClaim.cabang_tanggal_kirim_ke_pusat)} />
                      )}
                    </div>

                    {/* Dana */}
                    <div className="border rounded-xl p-5 space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                        <Banknote className="h-4 w-4" /> Dana Kematian
                      </h3>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-700">
                          {formatCurrency(activeClaim.besaran_dana_kematian)}
                        </div>
                        <div className="text-xs text-green-600 mt-0.5">Besaran dana yang disetujui</div>
                      </div>
                      {activeClaim.pusat_tanggal_validasi && (
                        <InfoRow label="Tanggal Validasi Pusat" value={formatDate(activeClaim.pusat_tanggal_validasi)} />
                      )}
                      {activeClaim.cabang_tanggal_serah_ke_ahli_waris && (
                        <InfoRow label="Tanggal Serah" value={formatDate(activeClaim.cabang_tanggal_serah_ke_ahli_waris)} />
                      )}
                      {activeClaim.keterangan && (
                        <div className="pt-2 border-t">
                          <div className="text-xs text-muted-foreground mb-1">Keterangan</div>
                          <p className="text-sm">{activeClaim.keterangan}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rejection info */}
                  {activeClaim.status_proses === 'ditolak' && activeClaim.rejection_reason && (
                    <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-5 flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-destructive text-sm mb-1">Alasan Penolakan</div>
                        <p className="text-sm">{activeClaim.rejection_reason}</p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ── Timeline Tab ── */}
                <TabsContent value="timeline" className="mt-0">
                  <div className="border rounded-xl p-6">
                    <DanaKematianTimeline claim={activeClaim} showLabels={true} />
                  </div>
                </TabsContent>

                {/* ── Dokumen Tab ── */}
                <TabsContent value="documents" className="mt-0">
                  <DocumentValidationSystem
                    claim={activeClaim}
                    readonly={!canEditDocuments}
                    onUpdate={canEditDocuments
                      ? (updates) => {
                          updateMutation.mutateAsync(updates as any).catch(() => {
                            showToast('Gagal menyimpan perubahan dokumen', 'error');
                          });
                        }
                      : undefined
                    }
                  />
                </TabsContent>

                {/* ── Laporan Tab ── */}
                <TabsContent value="reports" className="mt-0">
                  {allowsReporting(activeClaim.status_proses) || activeClaim.file_berita_acara ? (
                    <ReportGenerationSystem claim={activeClaim} readonly={true} />
                  ) : (
                    <div className="border rounded-xl p-12 text-center">
                      <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="font-medium text-muted-foreground">Laporan belum tersedia</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Laporan dapat dibuat pada tahap penyaluran dana.
                        Status saat ini: <strong>{getStatusProps(activeClaim.status_proses).label}</strong>
                      </p>
                    </div>
                  )}
                </TabsContent>

              </div>
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 border-t bg-background px-8 py-4 flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">

            {/* Step 1: Cabang → submit to Pusat */}
            {canSubmitToPusat && (
              <Button
                onClick={handleSubmitToPusat}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengirim...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Ajukan ke Pusat</>
                )}
              </Button>
            )}

            {/* Hint when Cabang but docs incomplete */}
            {!permissionLoading && canManagePC && activeClaim.status_proses === 'dilaporkan' && !requiredDocsUploaded && (
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Upload semua dokumen wajib untuk mengajukan
              </span>
            )}

            {/* Step 2: Pusat approves */}
            {!permissionLoading && canVerifyPP && activeClaim.status_proses === 'proses_pusat' && !allRequiredDocsVerified && (
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Verifikasi semua dokumen wajib di tab Dokumen terlebih dahulu
              </span>
            )}
            {canPusatApprove && (
              <Button
                onClick={handlePusatApprove}
                disabled={isPusatApproving}
                className="bg-green-600 hover:bg-green-700"
              >
                {isPusatApproving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</>
                ) : (
                  <><ShieldCheck className="h-4 w-4 mr-2" />Setujui Pengajuan</>
                )}
              </Button>
            )}

            {/* Step 3: Keuangan approves penyaluran */}
            {canKeuanganApprove && (
              <Button
                onClick={handleKeuanganApprove}
                disabled={isKeuanganApproving}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isKeuanganApproving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />Setujui Penyaluran</>
                )}
              </Button>
            )}

            {/* Step 4: Pusat confirms transfer */}
            {canConfirmTransfer && (
              <Button
                onClick={handleConfirmTransfer}
                disabled={isConfirmingTransfer}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isConfirmingTransfer ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</>
                ) : (
                  <><CreditCard className="h-4 w-4 mr-2" />Konfirmasi Transfer Dana</>
                )}
              </Button>
            )}
          </div>

          <DialogClose asChild>
            <Button variant="outline">Tutup</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>

      <ToastNotification
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(t => ({ ...t, show: false }))}
      />
    </Dialog>
  );
}

function WorkflowStatusBanner({ status }: { status: DanaKematian['status_proses'] }) {
  const steps = [
    { label: 'Input Data & Dokumen', key: 'dilaporkan' },
    { label: 'Verifikasi Pusat', key: 'proses_pusat' },
    { label: 'Persetujuan Keuangan', key: 'verified' },
    { label: 'Transfer Dana', key: 'penyaluran' },
    { label: 'Selesai', key: 'selesai' },
  ];

  const orderMap: Record<string, number> = {
    dilaporkan: 0,
    verifikasi_cabang: 0,
    pending_dokumen: 0,
    proses_pusat: 1,
    verified: 2,
    penyaluran: 3,
    selesai: 4,
    ditolak: -1,
  };

  const currentOrder = orderMap[status] ?? 0;

  if (status === 'ditolak') return null;

  return (
    <div className="border rounded-xl p-4 bg-muted/20">
      <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">Alur Pengajuan</p>
      <div className="flex items-center gap-0">
        {steps.map((step, i) => {
          const stepOrder = i;
          const isDone = currentOrder > stepOrder;
          const isCurrent = currentOrder === stepOrder;

          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isDone ? 'bg-green-500 text-white' :
                  isCurrent ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`text-xs text-center leading-tight ${
                  isCurrent ? 'font-semibold text-primary' :
                  isDone ? 'text-green-600' :
                  'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 shrink-0 ${
                  currentOrder > i ? 'bg-green-400' : 'bg-muted'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
