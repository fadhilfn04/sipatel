'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { DanaKematian } from '@/lib/supabase';

interface DocumentRequirement {
  key: keyof DanaKematian;
  verifiedKey: keyof DanaKematian;
  name: string;
  required: boolean;
  description: string;
  condition?: string;
}

interface DocumentValidationSystemProps {
  claim: DanaKematian;
  onUpdate?: (updates: Partial<DanaKematian>) => void;
  readonly?: boolean;
}

function isValidUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    key: 'file_surat_kematian',
    verifiedKey: 'dokumen_surat_kematian_verified',
    name: 'Akte Kematian',
    required: true,
    description: 'Akte/surat kematian resmi (DisDukCapil, Rumah Sakit, Kecamatan, atau lainnya)',
  },
  {
    key: 'file_sk_pensiun',
    verifiedKey: 'dokumen_sk_pensiun_verified',
    name: 'SK Pensiun',
    required: true,
    description: 'Surat Keputusan Pensiun dari instansi terkait (atau pernyataan resmi jika hilang)',
  },
  {
    key: 'file_surat_pernyataan_ahli_waris',
    verifiedKey: 'dokumen_surat_pernyataan_verified',
    name: 'Surat Keterangan / Surat Kuasa Ahli Waris',
    required: true,
    description: 'Surat Keterangan Ahli Waris untuk keluarga inti (istri/suami/anak), atau Surat Kuasa Ahli Waris untuk hubungan lainnya — harus dilegalisir',
  },
  {
    key: 'file_kartu_keluarga',
    verifiedKey: 'dokumen_kartu_keluarga_verified',
    name: 'Kartu Keluarga Ahli Waris',
    required: true,
    description: 'Kartu keluarga yang mencantumkan ahli waris sebagai garis keturunan langsung almarhum',
  },
  {
    key: 'file_e_ktp',
    verifiedKey: 'dokumen_ktp_ahli_waris_verified',
    name: 'E-KTP Ahli Waris',
    required: true,
    description: 'KTP elektronik ahli waris yang masih berlaku — nama harus sesuai dengan nama ahli waris yang diinput',
  },
  {
    key: 'file_surat_nikah',
    verifiedKey: 'dokumen_surat_nikah_verified',
    name: 'Surat Nikah',
    required: false,
    description: 'Buku nikah atau akta pernikahan',
    condition: 'Wajib jika ahli waris suami/istri — jika tidak ada, wajib mengisi keterangan',
  },
  {
    key: 'file_surat_keterangan',
    verifiedKey: 'dokumen_surat_keterangan_verified',
    name: 'Surat Permohonan',
    required: true,
    description: 'Surat permohonan/pengantar resmi dari cabang — wajib untuk proses selanjutnya',
  },
  {
    key: 'file_dokumen_pendukung',
    verifiedKey: 'dokumen_pendukung_verified',
    name: 'Dokumen Pendukung',
    required: false,
    description: 'Dokumen pendukung lainnya yang relevan dengan pengajuan',
  },
];

export function DocumentValidationSystem({
  claim,
  onUpdate,
  readonly = false,
}: DocumentValidationSystemProps) {
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<DocumentRequirement | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const toggleVerification = (doc: DocumentRequirement, verified: boolean) => {
    if (pendingKeys.has(doc.key)) return;
    setPendingKeys(prev => new Set(prev).add(doc.key));
    onUpdate?.({ [doc.verifiedKey]: verified } as Partial<DanaKematian>);
    setTimeout(() => setPendingKeys(prev => {
      const next = new Set(prev);
      next.delete(doc.key);
      return next;
    }), 1500);
  };

  const openRejectDialog = (doc: DocumentRequirement) => {
    setRejectTarget(doc);
    setRejectNote('');
  };

  const handleRejectConfirm = () => {
    if (!rejectTarget || !rejectNote.trim()) return;
    setIsRejecting(true);
    const existingMeta = (claim.document_metadata as Record<string, any>) || {};
    onUpdate?.({
      [rejectTarget.verifiedKey]: false,
      status_proses: 'pending_dokumen',
      document_metadata: {
        ...existingMeta,
        [`${rejectTarget.key}_rejection_note`]: rejectNote.trim(),
        [`${rejectTarget.key}_rejected_at`]: new Date().toISOString(),
      },
    } as Partial<DanaKematian>);
    setTimeout(() => {
      setIsRejecting(false);
      setRejectTarget(null);
      setRejectNote('');
    }, 1500);
  };

  const verifyAll = () => {
    DOCUMENT_REQUIREMENTS.forEach(doc => {
      const fileUrl = claim[doc.key] as string | null;
      const isVerified = claim[doc.verifiedKey] as boolean;
      if (fileUrl && !isVerified) {
        toggleVerification(doc, true);
      }
    });
  };

  const uploaded = DOCUMENT_REQUIREMENTS.filter(d => claim[d.key]).length;
  const verified = DOCUMENT_REQUIREMENTS.filter(d => claim[d.verifiedKey]).length;
  const requiredCount = DOCUMENT_REQUIREMENTS.filter(d => d.required).length;
  const requiredVerified = DOCUMENT_REQUIREMENTS.filter(d => d.required && claim[d.verifiedKey]).length;
  const allVerified = requiredVerified === requiredCount;
  const progressPct = Math.round((verified / DOCUMENT_REQUIREMENTS.length) * 100);

  const getFileName = (url: string) => {
    try {
      return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? url);
    } catch {
      return url;
    }
  };


  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Validasi Dokumen</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {uploaded} dari {DOCUMENT_REQUIREMENTS.length} dokumen diunggah ·{' '}
              {verified} terverifikasi
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={allVerified ? 'success' : 'secondary'}>
              {verified}/{DOCUMENT_REQUIREMENTS.length} Terverifikasi
            </Badge>
            {!readonly && uploaded > verified && (
              <Button size="sm" variant="outline" onClick={verifyAll}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Verifikasi Semua
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress verifikasi</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                allVerified ? 'bg-green-500' : 'bg-primary'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Document list */}
      <div className="space-y-2">
        {DOCUMENT_REQUIREMENTS.map((doc) => {
          const fileUrl = claim[doc.key] as string | null;
          const isVerified = claim[doc.verifiedKey] as boolean;
          const isPending = pendingKeys.has(doc.key);
          const meta = (claim.document_metadata as Record<string, any>) || {};
          const rejectionNote = meta[`${doc.key}_rejection_note`] as string | undefined;
          const isRejected = !!rejectionNote && !isVerified;

          const state = !fileUrl ? 'missing' : isVerified ? 'verified' : isRejected ? 'rejected' : 'uploaded';

          return (
            <div
              key={doc.key}
              className={`border rounded-xl p-4 transition-colors ${
                state === 'verified'
                  ? 'bg-green-50 border-green-200'
                  : state === 'rejected'
                    ? 'bg-red-50/60 border-red-200'
                    : state === 'uploaded'
                      ? 'bg-blue-50/50 border-blue-200'
                      : 'bg-muted/40 border-muted'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                  state === 'verified' ? 'bg-green-100' :
                  state === 'rejected' ? 'bg-red-100' :
                  state === 'uploaded' ? 'bg-blue-100' :
                  'bg-muted'
                }`}>
                  {state === 'verified' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : state === 'rejected' ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : state === 'uploaded' ? (
                    <FileText className="h-4 w-4 text-blue-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-medium text-sm">{doc.name}</span>
                    {doc.required ? (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0">Wajib</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">Opsional</Badge>
                    )}
                    {doc.condition && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">{doc.condition}</Badge>
                    )}
                    <Badge
                      variant={state === 'verified' ? 'success' : state === 'rejected' ? 'destructive' : state === 'uploaded' ? 'secondary' : 'outline'}
                      className="text-xs px-1.5 py-0"
                    >
                      {state === 'verified' ? 'Terverifikasi' : state === 'rejected' ? 'Ditolak' : state === 'uploaded' ? 'Menunggu Verifikasi' : 'Belum Diunggah'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{doc.description}</p>
                  {fileUrl && (
                    <p className="text-xs text-muted-foreground mt-1 truncate max-w-sm">
                      {getFileName(fileUrl)}
                    </p>
                  )}
                  {/* Rejection note */}
                  {rejectionNote && !isVerified && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-100/60 border border-red-200 px-2.5 py-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">{rejectionNote}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isValidUrl(fileUrl) && (
                    <a
                      href={fileUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Lihat dokumen"
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}

                  {!readonly && isValidUrl(fileUrl) && !isVerified && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => openRejectDialog(doc)}
                      disabled={isPending}
                    >
                      <XCircle className="h-3.5 w-3.5" />Tolak
                    </Button>
                  )}

                  {!readonly && isValidUrl(fileUrl) && (
                    <Button
                      size="sm"
                      variant={isVerified ? 'outline' : 'primary'}
                      className={`h-8 text-xs gap-1.5 ${isVerified ? 'border-red-200 text-red-600 hover:bg-red-50' : ''}`}
                      onClick={() => toggleVerification(doc, !isVerified)}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <span className="text-xs">Menyimpan...</span>
                      ) : isVerified ? (
                        <><XCircle className="h-3.5 w-3.5" />Batalkan</>
                      ) : (
                        <><CheckCircle2 className="h-3.5 w-3.5" />Verifikasi</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {allVerified && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="font-medium text-green-800 text-sm">Semua dokumen wajib telah terverifikasi</p>
            <p className="text-xs text-green-700 mt-0.5">Pengajuan siap disetujui dan disalurkan ke ahli waris</p>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Tolak Dokumen: {rejectTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Berikan keterangan mengapa dokumen ini ditolak. Status pengajuan akan berubah ke{' '}
              <strong className="text-destructive">Revisi Pusat</strong> dan cabang perlu mengupload ulang dokumen yang benar.
            </p>
            <Textarea
              placeholder="Contoh: Dokumen tidak terbaca, foto buram, dokumen kadaluarsa, tanda tangan tidak ada, dll."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={isRejecting}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectNote.trim() || isRejecting}
            >
              {isRejecting ? 'Menyimpan...' : 'Tolak Dokumen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Compact version for inline use (kept for other components that may use it)
export function DocumentValidationCompact({ claim }: { claim: DanaKematian }) {
  const requiredDocs: (keyof DanaKematian)[] = [
    'file_surat_kematian',
    'file_sk_pensiun',
    'file_surat_pernyataan_ahli_waris',
    'file_kartu_keluarga',
    'file_e_ktp',
  ];
  const verifiedFields: (keyof DanaKematian)[] = [
    'dokumen_surat_kematian_verified',
    'dokumen_sk_pensiun_verified',
    'dokumen_surat_pernyataan_verified',
    'dokumen_kartu_keluarga_verified',
    'dokumen_ktp_ahli_waris_verified',
  ];

  const uploaded = requiredDocs.filter(d => claim[d]).length;
  const verified = verifiedFields.filter(f => claim[f]).length;

  return (
    <div className="flex items-center gap-2">
      <Badge variant={verified === requiredDocs.length ? 'success' : uploaded === requiredDocs.length ? 'secondary' : 'destructive'}>
        Dokumen: {verified}/{requiredDocs.length}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {uploaded} diunggah, {verified} terverifikasi
      </span>
    </div>
  );
}
