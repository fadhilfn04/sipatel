'use client';

import { useState, useRef } from 'react';
import {
  User,
  Users,
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
  Info,
  Heart,
  Star,
  Upload,
  HandshakeIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type PendingAction = 'submit_pusat' | 'pusat_approve' | null;

// ── Confirm config per action ─────────────────────────────────────────────────
const CONFIRM_CONFIG: Record<NonNullable<PendingAction>, {
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass: string;
  icon: React.ReactNode;
}> = {
  submit_pusat: {
    title: 'Kirim ke PP?',
    description: 'Pengajuan ini akan dikirim ke PP untuk diverifikasi. Pastikan semua dokumen wajib sudah diupload dan data sudah benar sebelum melanjutkan.',
    confirmLabel: 'Ya, Kirim ke PP',
    confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    icon: <Send className="h-5 w-5 text-blue-600" />,
  },
  pusat_approve: {
    title: 'Setujui & Salurkan Dana?',
    description: 'Anda akan menyetujui pengajuan ini. Dana langsung masuk tahap penyaluran — tidak ada langkah persetujuan keuangan terpisah. Pastikan seluruh dokumen telah diverifikasi.',
    confirmLabel: 'Ya, Setujui & Salurkan',
    confirmClass: 'bg-green-600 hover:bg-green-700 text-white',
    icon: <ShieldCheck className="h-5 w-5 text-green-600" />,
  },
};

export function DanaKematianDetailModal({ open, onClose, claim, onRefresh }: DanaKematianDetailModalProps) {
  const { canVerifyPP, canManagePC, isLoading: permissionLoading } = useUserPermissions();

  const { data: freshClaim } = useDanaKematian(claim?.id || '');
  const activeClaim = freshClaim ?? claim;

  const updateMutation = useUpdateDanaKematian(activeClaim?.id || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPusatApproving, setIsPusatApproving] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  // Delivery dialog state (PC fills delivery date + uploads proof)
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryFileUrl, setDeliveryFileUrl] = useState('');
  const [deliveryUploading, setDeliveryUploading] = useState(false);
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false);
  const deliveryFileRef = useRef<HTMLInputElement>(null);

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

  const canSubmitToPusat =
    !permissionLoading && canManagePC &&
    activeClaim.status_proses === 'dilaporkan' && requiredDocsUploaded;

  // PP can approve from proses_pusat (normal) or verified (legacy, skip keuangan)
  const canPusatApprove =
    !permissionLoading && canVerifyPP &&
    ((activeClaim.status_proses === 'proses_pusat' && allRequiredDocsVerified) ||
      activeClaim.status_proses === 'verified');

  // PC does the final delivery confirmation
  const canConfirmDelivery =
    !permissionLoading && canManagePC &&
    activeClaim.status_proses === 'penyaluran';

  const canEditDocuments =
    canVerifyPP && activeClaim.status_proses === 'proses_pusat';

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleConfirmedAction = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);

    try {
      if (action === 'submit_pusat') {
        setIsSubmitting(true);
        await updateMutation.mutateAsync({
          status_proses: 'proses_pusat',
          cabang_tanggal_kirim_ke_pusat: new Date().toISOString().split('T')[0],
        } as any);
        showToast('Pengajuan berhasil dikirim ke PP', 'success');
      } else if (action === 'pusat_approve') {
        setIsPusatApproving(true);
        const now = new Date().toISOString();
        await updateMutation.mutateAsync({
          status_proses: 'penyaluran',
          pusat_tanggal_validasi: now.split('T')[0],
          waktu_3: now,
          waktu_4: now,
        } as any);
        showToast('Pengajuan disetujui, dana siap disalurkan ke ahli waris', 'success');
      }
      onRefresh?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
    } finally {
      setIsSubmitting(false);
      setIsPusatApproving(false);
    }
  };

  const handleDeliveryFileUpload = async (file: File) => {
    setDeliveryUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'dana-kematian');
      fd.append('folder', 'bukti-penyerahan');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload gagal');
      setDeliveryFileUrl(json.url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload gagal', 'error');
    } finally {
      setDeliveryUploading(false);
    }
  };

  const handleDeliveryConfirm = async () => {
    if (!deliveryDate) {
      showToast('Tanggal penyerahan wajib diisi', 'error');
      return;
    }
    setIsConfirmingDelivery(true);
    try {
      const now = new Date().toISOString();
      await updateMutation.mutateAsync({
        status_proses: 'selesai',
        cabang_tanggal_serah_ke_ahli_waris: deliveryDate,
        cabang_tanggal_lapor_ke_pusat: deliveryDate,
        pusat_tanggal_selesai: deliveryDate,
        ...(deliveryFileUrl ? { file_bukti_penyerahan: deliveryFileUrl } : {}),
        waktu_6: now,
        waktu_7: now,
      } as any);
      setShowDeliveryDialog(false);
      showToast('Dana berhasil diserahkan ke ahli waris. Pengajuan selesai.', 'success');
      onRefresh?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
    } finally {
      setIsConfirmingDelivery(false);
    }
  };

  const isAnyPending = isSubmitting || isPusatApproving || isConfirmingDelivery;

  const getStatusProps = (status: DanaKematian['status_proses']): StatusProps => {
    const map: Record<string, StatusProps> = {
      dilaporkan:        { variant: 'secondary',   label: 'Dilaporkan',        color: 'text-gray-600' },
      verifikasi_cabang: { variant: 'warning',     label: 'Verifikasi Cabang', color: 'text-amber-600' },
      pending_dokumen:   { variant: 'destructive',  label: 'Revisi Dokumen',    color: 'text-red-600' },
      proses_pusat:      { variant: 'warning',     label: 'Proses Pusat',      color: 'text-blue-600' },
      revisi_pusat:      { variant: 'destructive', label: 'Revisi Pusat',      color: 'text-red-600' },
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

  // Speed rating — only shown when status is selesai
  const speedRating = (() => {
    if (activeClaim.status_proses !== 'selesai') return null;
    const start = activeClaim.cabang_tanggal_awal_terima_berkas || activeClaim.tanggal_meninggal;
    const end = activeClaim.cabang_tanggal_serah_ke_ahli_waris || activeClaim.pusat_tanggal_selesai;
    if (!start || !end) return null;
    const days = Math.max(0, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)));
    if (days <= 7)  return { days, stars: 5, label: 'Sangat Cepat', color: 'text-green-700',  bg: 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800' };
    if (days <= 14) return { days, stars: 4, label: 'Cepat',        color: 'text-green-600',  bg: 'bg-green-50/70 border-green-200 dark:bg-green-950/30 dark:border-green-800' };
    if (days <= 21) return { days, stars: 3, label: 'Normal',       color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800' };
    if (days <= 30) return { days, stars: 2, label: 'Lambat',       color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800' };
    return             { days, stars: 1, label: 'Sangat Lambat', color: 'text-red-700',    bg: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800' };
  })();

  // Parse susunan keluarga
  let familyMembers: Array<{ nama: string; hubungan: string }> = [];
  try {
    const parsed = JSON.parse(activeClaim.susunan_keluarga || '[]');
    if (Array.isArray(parsed)) familyMembers = parsed;
  } catch { /* ignore */ }

  const statusProps = getStatusProps(activeClaim.status_proses);
  const confirmConfig = pendingAction ? CONFIRM_CONFIG[pendingAction] : null;

  return (
    <>
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

                    {/* Speed rating — shown only when selesai */}
                    {speedRating && (
                      <div className={`border rounded-xl p-5 ${speedRating.bg}`}>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Penilaian Kecepatan Proses</p>
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-bold ${speedRating.color}`}>{speedRating.label}</span>
                              <span className="text-sm text-muted-foreground">({speedRating.days} hari)</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Dihitung dari terima berkas hingga penyerahan ke ahli waris</p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-6 w-6 ${i < speedRating.stars ? `fill-current ${speedRating.color}` : 'text-muted-foreground/30'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-current/10 grid grid-cols-3 gap-4 text-center text-xs">
                          {activeClaim.cabang_tanggal_awal_terima_berkas && (
                            <div>
                              <p className="text-muted-foreground">Terima Berkas</p>
                              <p className="font-medium">{formatDate(activeClaim.cabang_tanggal_awal_terima_berkas)}</p>
                            </div>
                          )}
                          {activeClaim.pusat_tanggal_validasi && (
                            <div>
                              <p className="text-muted-foreground">Validasi PP</p>
                              <p className="font-medium">{formatDate(activeClaim.pusat_tanggal_validasi)}</p>
                            </div>
                          )}
                          {activeClaim.cabang_tanggal_serah_ke_ahli_waris && (
                            <div>
                              <p className="text-muted-foreground">Serah ke AW</p>
                              <p className="font-medium">{formatDate(activeClaim.cabang_tanggal_serah_ke_ahli_waris)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Row 1: Data Anggota + Susunan Keluarga */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Data Almarhum */}
                      <div className="border rounded-xl p-5 space-y-3">
                        <h3 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                          <User className="h-4 w-4" /> Data Almarhum / Almarhumah
                        </h3>
                        {(activeClaim as any).anggota?.nik && (
                          <InfoRow label="NIK" value={<span className="font-mono text-xs">{(activeClaim as any).anggota.nik}</span>} />
                        )}
                        <InfoRow label="Nama Lengkap" value={<span className="font-semibold">{activeClaim.nama_anggota}</span>} />
                        <InfoRow label="Status Anggota" value={<Badge variant="secondary">{activeClaim.status_anggota}</Badge>} />
                        <InfoRow label="Status MPS" value={<Badge variant="outline">{activeClaim.status_mps}</Badge>} />
                        <div className="border-t pt-3 space-y-3">
                          <InfoRow label="Tanggal Meninggal" value={
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDate(activeClaim.tanggal_meninggal)}
                            </span>
                          } />
                          {activeClaim.penyebab_meninggal && (
                            <InfoRow label="Penyebab Meninggal" value={activeClaim.penyebab_meninggal} />
                          )}
                        </div>
                        <div className="border-t pt-3 space-y-3">
                          <InfoRow label="Cabang Pelapor" value={activeClaim.cabang_asal_melapor} />
                          {activeClaim.cabang_nama_pelapor && (
                            <InfoRow label="Nama Pelapor" value={activeClaim.cabang_nama_pelapor} />
                          )}
                          {activeClaim.cabang_nik_pelapor && (
                            <InfoRow label="NIK Pelapor" value={<span className="font-mono text-xs">{activeClaim.cabang_nik_pelapor}</span>} />
                          )}
                          {activeClaim.cabang_tanggal_awal_terima_berkas && (
                            <InfoRow label="Terima Berkas" value={formatDate(activeClaim.cabang_tanggal_awal_terima_berkas)} />
                          )}
                          {activeClaim.cabang_tanggal_kirim_ke_pusat && (
                            <InfoRow label="Dikirim ke PP" value={formatDate(activeClaim.cabang_tanggal_kirim_ke_pusat)} />
                          )}
                        </div>
                      </div>

                      {/* Susunan Keluarga */}
                      <div className="border rounded-xl p-5 space-y-3">
                        <h3 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                          <Users className="h-4 w-4" /> Susunan Keluarga
                        </h3>

                        {/* Deceased node */}
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/15">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{activeClaim.nama_anggota}</p>
                            <p className="text-xs text-muted-foreground">Almarhum / Almarhumah</p>
                          </div>
                        </div>

                        {familyMembers.length === 0 ? (
                          <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                            <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            Susunan keluarga belum diisi
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex justify-center">
                              <div className="w-0.5 h-3 bg-border" />
                            </div>
                            {familyMembers.map((member, i) => (
                              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-muted/30">
                                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                                  <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{member.nama || '—'}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{member.hubungan}</p>
                                </div>
                                <Badge variant="secondary" className="text-[10px] px-1.5 h-5 shrink-0">
                                  {member.hubungan}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Ahli Waris + Dana */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Ahli Waris */}
                      <div className="border rounded-xl p-5 space-y-3">
                        <h3 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                          <User className="h-4 w-4" /> Data Ahli Waris
                        </h3>
                        <InfoRow label="Nama Ahli Waris" value={<span className="font-semibold">{activeClaim.nama_ahli_waris}</span>} />
                        <InfoRow label="Hubungan dengan Almarhum" value={
                          <Badge variant="secondary" className="capitalize">{activeClaim.status_ahli_waris}</Badge>
                        } />
                        {activeClaim.keterangan && (
                          <InfoRow label="Keterangan" value={activeClaim.keterangan} />
                        )}
                        {activeClaim.no_hp_ahli_waris && (
                          <InfoRow label="No. HP" value={
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              {activeClaim.no_hp_ahli_waris}
                            </span>
                          } />
                        )}
                        {activeClaim.nik_ahli_waris && (
                          <InfoRow label="NIK" value={<span className="font-mono text-xs">{activeClaim.nik_ahli_waris}</span>} />
                        )}
                        {activeClaim.alamat_ahli_waris && (
                          <div className="pt-2 border-t">
                            <div className="text-xs text-muted-foreground mb-1">Alamat</div>
                            <p className="text-sm">{activeClaim.alamat_ahli_waris}</p>
                          </div>
                        )}
                      </div>

                      {/* Dana */}
                      <div className="border rounded-xl p-5 space-y-3">
                        <h3 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                          <Banknote className="h-4 w-4" /> Dana Kematian
                        </h3>
                        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {formatCurrency(activeClaim.besaran_dana_kematian)}
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-500 mt-0.5">Besaran dana yang disetujui</div>
                        </div>
                        {activeClaim.pusat_tanggal_validasi && (
                          <InfoRow label="Tanggal Validasi Pusat" value={formatDate(activeClaim.pusat_tanggal_validasi)} />
                        )}
                        {activeClaim.cabang_tanggal_serah_ke_ahli_waris && (
                          <InfoRow label="Tanggal Serah ke AW" value={formatDate(activeClaim.cabang_tanggal_serah_ke_ahli_waris)} />
                        )}
                        {activeClaim.pusat_tanggal_selesai && (
                          <InfoRow label="Tanggal Selesai" value={formatDate(activeClaim.pusat_tanggal_selesai)} />
                        )}
                        {activeClaim.cabang_tanggal_lapor_ke_pusat && (
                          <InfoRow label="Lapor ke PP" value={formatDate(activeClaim.cabang_tanggal_lapor_ke_pusat)} />
                        )}
                        {activeClaim.file_bukti_penyerahan && (
                          <div className="pt-2 border-t">
                            <a
                              href={activeClaim.file_bukti_penyerahan}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Lihat Bukti Penyerahan
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Revisi Pusat info */}
                    {(activeClaim.status_proses === 'revisi_pusat' || activeClaim.status_proses === 'pending_dokumen') && (
                      <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-5 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-destructive text-sm mb-1">Dokumen Perlu Direvisi</div>
                          <p className="text-sm text-muted-foreground">
                            PP telah menolak satu atau lebih dokumen. Cabang perlu mengupload ulang dokumen yang benar, lalu mengirimkan kembali ke PP.
                          </p>
                        </div>
                      </div>
                    )}

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
                      <DanaKematianTimeline claim={activeClaim} />
                    </div>
                  </TabsContent>

                  {/* ── Dokumen Tab ── */}
                  <TabsContent value="documents" className="mt-0">
                    <DocumentValidationSystem
                      claim={activeClaim}
                      readonly={!canEditDocuments}
                      onUpdate={canEditDocuments
                        ? (updates) => {
                            updateMutation.mutateAsync(updates as any).then(() => {
                              onRefresh?.();
                            }).catch(() => {
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
                  onClick={() => setPendingAction('submit_pusat')}
                  disabled={isAnyPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengirim...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" />Ajukan ke PP</>
                  )}
                </Button>
              )}

              {/* Hint: docs incomplete */}
              {!permissionLoading && canManagePC && activeClaim.status_proses === 'dilaporkan' && !requiredDocsUploaded && (
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Upload semua dokumen wajib untuk mengajukan
                </span>
              )}

              {/* Hint: docs not verified */}
              {!permissionLoading && canVerifyPP && activeClaim.status_proses === 'proses_pusat' && !allRequiredDocsVerified && (
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Verifikasi semua dokumen wajib di tab Dokumen terlebih dahulu
                </span>
              )}

              {/* Step 2: Pusat approves → penyaluran */}
              {canPusatApprove && (
                <Button
                  onClick={() => setPendingAction('pusat_approve')}
                  disabled={isAnyPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isPusatApproving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4 mr-2" />Setujui & Salurkan</>
                  )}
                </Button>
              )}

              {/* Step 3: PC confirms delivery to ahli waris */}
              {canConfirmDelivery && (
                <Button
                  onClick={() => {
                    setDeliveryDate(new Date().toISOString().split('T')[0]);
                    setDeliveryFileUrl('');
                    setShowDeliveryDialog(true);
                  }}
                  disabled={isAnyPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isConfirmingDelivery ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</>
                  ) : (
                    <><HandshakeIcon className="h-4 w-4 mr-2" />Serahkan ke Ahli Waris</>
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

      {/* ── Confirmation AlertDialog (submit/pusat_approve) ─────────────── */}
      <AlertDialog open={!!pendingAction} onOpenChange={(v) => { if (!v) setPendingAction(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                {confirmConfig?.icon}
              </div>
              <AlertDialogTitle className="text-lg">
                {confirmConfig?.title}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm leading-relaxed">
              {confirmConfig?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Summary of the claim being actioned */}
          <div className="my-1 rounded-lg border bg-muted/40 px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nama Anggota</span>
              <span className="font-semibold">{activeClaim.nama_anggota}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ahli Waris</span>
              <span className="font-medium">{activeClaim.nama_ahli_waris}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Besaran Dana</span>
              <span className="font-semibold text-green-700 dark:text-green-400">
                {formatCurrency(activeClaim.besaran_dana_kematian)}
              </span>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingAction(null)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className={confirmConfig?.confirmClass}
              onClick={handleConfirmedAction}
            >
              {confirmConfig?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delivery Dialog (PC fills date + uploads proof) ────────────── */}
      <Dialog open={showDeliveryDialog} onOpenChange={(v) => { if (!v) setShowDeliveryDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandshakeIcon className="h-5 w-5 text-emerald-600" />
              Penyerahan Dana ke Ahli Waris
            </DialogTitle>
            <DialogDescription>
              Isi tanggal penyerahan dan upload bukti dokumen. Status pengajuan akan berubah menjadi <strong>Selesai</strong>.
            </DialogDescription>
          </DialogHeader>

          {/* Claim summary */}
          <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nama Anggota</span>
              <span className="font-semibold">{activeClaim.nama_anggota}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ahli Waris</span>
              <span className="font-medium">{activeClaim.nama_ahli_waris}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Besaran Dana</span>
              <span className="font-semibold text-green-700 dark:text-green-400">
                {formatCurrency(activeClaim.besaran_dana_kematian)}
              </span>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tanggal Penyerahan *</label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bukti Penyerahan</label>
              <input
                ref={deliveryFileRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDeliveryFileUpload(file);
                  e.target.value = '';
                }}
              />
              <div
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                  deliveryUploading ? 'border-primary/50 bg-primary/5 cursor-wait' :
                  deliveryFileUrl ? 'border-green-400 bg-green-50 hover:bg-green-100' :
                  'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
                }`}
                onClick={() => !deliveryUploading && deliveryFileRef.current?.click()}
              >
                {deliveryUploading ? (
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Mengupload...</span>
                  </div>
                ) : deliveryFileUrl ? (
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Dokumen terupload — klik untuk ganti</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Klik untuk upload bukti penyerahan</p>
                    <p className="text-xs text-muted-foreground">PDF, JPG, PNG (opsional)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeliveryDialog(false)} disabled={isConfirmingDelivery}>
              Batal
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleDeliveryConfirm}
              disabled={!deliveryDate || isConfirmingDelivery || deliveryUploading}
            >
              {isConfirmingDelivery ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" />Konfirmasi Penyerahan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function WorkflowStatusBanner({ status }: { status: DanaKematian['status_proses'] }) {
  const steps = [
    { label: 'Input Data & Dokumen', key: 'dilaporkan' },
    { label: 'Verifikasi PP',        key: 'proses_pusat' },
    { label: 'Penyaluran Dana',      key: 'penyaluran' },
    { label: 'Selesai',              key: 'selesai' },
  ];

  const orderMap: Record<string, number> = {
    dilaporkan: 0, verifikasi_cabang: 0,
    proses_pusat: 1, pending_dokumen: 1, revisi_pusat: 1, verified: 1,
    penyaluran: 2, selesai: 3, ditolak: -1,
  };

  const currentOrder = orderMap[status] ?? 0;
  if (status === 'ditolak') return null;

  return (
    <div className="border rounded-xl p-4 bg-muted/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Alur Pengajuan</p>
        {status === 'revisi_pusat' && (
          <Badge variant="destructive" className="text-xs">Perlu Revisi Dokumen</Badge>
        )}
      </div>
      <div className="flex items-center gap-0">
        {steps.map((step, i) => {
          const isDone = currentOrder > i;
          const isCurrent = currentOrder === i;
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
                  isDone ? 'text-green-600' : 'text-muted-foreground'
                }`}>{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 shrink-0 ${currentOrder > i ? 'bg-green-400' : 'bg-muted'}`} />
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
