'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  Download,
  AlertTriangle,
  ChevronRight,
  Clock,
  Calculator
} from 'lucide-react';
import { DanaKematian } from '@/lib/supabase';
import { canTransition, DanaKematianStatus } from '@/lib/workflow/dana-kematian-state-machine';

interface PPVerificationPanelProps {
  claim: DanaKematian;
  onVerificationComplete?: (result: VerificationResult) => void;
  readonly?: boolean;
}

interface VerificationResult {
  approved: boolean;
  rejectionReason?: string;
  rejectionCategory?: string;
  notes: string;
  verifiedBy: string;
  verifiedAt: Date;
  benefitAmount?: number;
}

export function PPVerificationPanel({ claim, onVerificationComplete, readonly = false }: PPVerificationPanelProps) {
  const [activeTab, setActiveTab] = useState<'documents' | 'eligibility' | 'calculation' | 'approval'>('documents');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionCategory, setRejectionCategory] = useState('');
  const [benefitAmount, setBenefitAmount] = useState(claim.besaran_dana_kematian);

  // Document verification state
  const [documentVerifications, setDocumentVerifications] = useState({
    file_surat_kematian: {
      verified: claim.dokumen_surat_kematian_verified,
      notes: '',
      issues: []
    },
    file_sk_pensiun: {
      verified: claim.dokumen_sk_pensiun_verified,
      notes: '',
      issues: []
    },
    file_surat_pernyataan_ahli_waris: {
      verified: claim.dokumen_surat_pernyataan_verified,
      notes: '',
      issues: []
    },
    file_kartu_keluarga: {
      verified: claim.dokumen_kartu_keluarga_verified,
      notes: '',
      issues: []
    },
    file_e_ktp: {
      verified: claim.dokumen_ktp_ahli_waris_verified,
      notes: '',
      issues: []
    },
    file_buku_rekening: {
      verified: claim.dokumen_buku_rekening_verified,
      notes: '',
      issues: []
    }
  });

  // Eligibility verification state
  const [eligibilityChecks, setEligibilityChecks] = useState({
    memberStatusValid: true,
    memberCategoryCorrect: true,
    mpsStatusVerified: true,
    heirRelationshipConfirmed: true,
    heirEligibilityVerified: true,
    noDuplicateClaims: true,
    withinTimeLimit: true
  });

  const requiredDocuments = [
    { key: 'file_surat_kematian', name: 'Surat Kematian', required: true },
    { key: 'file_sk_pensiun', name: 'SK Pensiun', required: true },
    { key: 'file_surat_pernyataan_ahli_waris', name: 'Surat Pernyataan Ahli Waris', required: true },
    { key: 'file_kartu_keluarga', name: 'Kartu Keluarga', required: true },
    { key: 'file_e_ktp', name: 'E-KTP Ahli Waris', required: true },
    { key: 'file_buku_rekening', name: 'Buku Rekening', required: true }
  ];

  const getDocumentStatus = (docKey: string) => {
    const docUrl = claim[docKey as keyof DanaKematian];
    const verification = documentVerifications[docKey as keyof typeof documentVerifications];

    if (!docUrl) return { status: 'missing', label: 'Tidak Ada', icon: XCircle };
    if (verification.verified) return { status: 'verified', label: 'Terverifikasi', icon: CheckCircle2 };
    return { status: 'pending', label: 'Perlu Verifikasi', icon: Clock };
  };

  const toggleDocumentVerification = (docKey: string, verified: boolean, notes?: string) => {
    setDocumentVerifications(prev => ({
      ...prev,
      [docKey]: {
        ...prev[docKey as keyof typeof prev],
        verified,
        notes: notes || prev[docKey as keyof typeof prev].notes
      }
    }));
  };

  const calculateTotalVerification = () => {
    const allDocumentsVerified = requiredDocuments.every(doc =>
      claim[doc.key as keyof DanaKematian] && documentVerifications[doc.key as keyof typeof documentVerifications]?.verified
    );

    const allEligibilityChecksPassed = Object.values(eligibilityChecks).every(check => check === true);

    return {
      documents: allDocumentsVerified,
      eligibility: allEligibilityChecksPassed,
      overall: allDocumentsVerified && allEligibilityChecksPassed
    };
  };

  const handleApprove = () => {
    const verification = calculateTotalVerification();

    if (!verification.overall) {
      alert('Harap verifikasi semua dokumen dan eligibility sebelum menyetujui');
      return;
    }

    const result: VerificationResult = {
      approved: true,
      notes: verificationNotes,
      verifiedBy: 'PP Validator',
      verifiedAt: new Date(),
      benefitAmount: benefitAmount
    };

    onVerificationComplete?.(result);
  };

  const handleReject = () => {
    if (!rejectionCategory || !rejectionReason) {
      alert('Harap isi kategori dan alasan penolakan');
      return;
    }

    const result: VerificationResult = {
      approved: false,
      rejectionReason,
      rejectionCategory,
      notes: verificationNotes,
      verifiedBy: 'PP Validator',
      verifiedAt: new Date()
    };

    onVerificationComplete?.(result);
  };

  const handleReturnToPC = () => {
    if (!verificationNotes) {
      alert('Harap isi catatan untuk pengembalian ke PC');
      return;
    }

    const result: VerificationResult = {
      approved: false,
      rejectionReason: 'Dokumen dikembalikan ke PC untuk perbaikan',
      rejectionCategory: 'document',
      notes: verificationNotes,
      verifiedBy: 'PP Validator',
      verifiedAt: new Date()
    };

    onVerificationComplete?.(result);
  };

  const verification = calculateTotalVerification();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Verifikasi Pengajuan (PP)</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Phase D: Verifikasi formal dokumen dan eligibility pengajuan dana kematian
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={claim.status_proses === 'verified' ? 'success' : 'secondary'}>
              Status: {claim.status_proses === 'proses_pusat' ? 'Dalam Verifikasi' : claim.status_proses}
            </Badge>
          </div>
        </div>

        {/* Timeline info */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-900">Waktu-2 (Diterima):</span>
              <p className="text-blue-800">
                {claim.waktu_2 ? new Date(claim.waktu_2).toLocaleDateString('id-ID') : '-'}
              </p>
            </div>
            <div>
              <span className="font-medium text-blue-900">Waktu-3 (Target):</span>
              <p className="text-blue-800">
                {claim.waktu_3 ? new Date(claim.waktu_3).toLocaleDateString('id-ID') : 'Dalam proses'}
              </p>
            </div>
            <div>
              <span className="font-medium text-blue-900">Asal PC:</span>
              <p className="text-blue-800">{claim.cabang_asal_melapor}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Verification Progress */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Progress Verifikasi</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg border-2 ${
            verification.documents ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {verification.documents ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Clock className="h-5 w-5 text-yellow-600" />}
              <span className="font-medium">Kelengkapan Dokumen</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {requiredDocuments.filter(d => claim[d.key as keyof DanaKematian]).length}/{requiredDocuments.length} dokumen
            </p>
          </div>

          <div className={`p-4 rounded-lg border-2 ${
            verification.eligibility ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {verification.eligibility ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Clock className="h-5 w-5 text-yellow-600" />}
              <span className="font-medium">Eligibility</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {Object.values(eligibilityChecks).filter(Boolean).length}/{Object.keys(eligibilityChecks).length} checks
            </p>
          </div>

          <div className={`p-4 rounded-lg border-2 ${
            verification.overall ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {verification.overall ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Clock className="h-5 w-5 text-yellow-600" />}
              <span className="font-medium">Status Verifikasi</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {verification.overall ? 'Siap disetujui' : 'Perlu verifikasi lengkap'}
            </p>
          </div>
        </div>
      </Card>

      {/* Verification Tabs */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          {['documents', 'eligibility', 'calculation', 'approval'].map((tab, index, tabs) => (
            <React.Fragment key={tab}>
              <button
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab === 'documents' && '📄 Dokumen'}
                {tab === 'eligibility' && '✅ Eligibility'}
                {tab === 'calculation' && '💰 Perhitungan'}
                {tab === 'approval' && '🎯 Persetujuan'}
              </button>
              {index < tabs.length - 1 && (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-3">Verifikasi Dokumen (Berkas-2)</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Periksa kelengkapan, keaslian, dan kesesuaian semua dokumen yang dikirim PC
              </p>

              <div className="space-y-3">
                {requiredDocuments.map((doc) => {
                  const docUrl = claim[doc.key as keyof DanaKematian];
                  const docStatus = getDocumentStatus(doc.key);
                  const StatusIcon = docStatus.icon;
                  const verification = documentVerifications[doc.key as keyof typeof documentVerifications];

                  return (
                    <div key={doc.key} className="p-4 border rounded-lg bg-white">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h5 className="font-medium">{doc.name}</h5>
                            <Badge variant={doc.required ? 'destructive' : 'secondary'} className="text-xs">
                              {doc.required ? 'Wajib' : 'Opsional'}
                            </Badge>
                            <Badge
                              variant={
                                docStatus.status === 'verified' ? 'success' :
                                docStatus.status === 'pending' ? 'secondary' :
                                'destructive'
                              }
                              className="text-xs"
                            >
                              {docStatus.label}
                            </Badge>
                          </div>

                          {docUrl && (
                            <div className="flex items-center gap-2 mt-2">
                              <Button size="sm" variant="outline" className="h-8 gap-1">
                                <Eye className="h-3 w-3" />
                                Preview
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 gap-1">
                                <Download className="h-3 w-3" />
                                Download
                              </Button>
                            </div>
                          )}

                          {verification.notes && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                              <strong>Catatan:</strong> {verification.notes}
                            </div>
                          )}
                        </div>

                        {docUrl && !readonly && (
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              variant={verification.verified ? 'default' : 'outline'}
                              onClick={() => toggleDocumentVerification(doc.key, !verification.verified)}
                              className="gap-1"
                            >
                              {verification.verified ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Verified
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Verify
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Eligibility Tab */}
        {activeTab === 'eligibility' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-3">Verifikasi Eligibility</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Pastikan anggota dan ahli waris memenuhi syarat untuk menerima dana kematian
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Member Information */}
                <div className="p-4 bg-white border rounded-lg">
                  <h5 className="font-medium mb-3">Data Anggota</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Nama:</span>
                      <span className="font-medium">{claim.nama_anggota}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status MPS:</span>
                      <Badge variant={claim.status_mps === 'mps' ? 'success' : 'secondary'}>
                        {claim.status_mps}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Status Anggota:</span>
                      <span className="font-medium">{claim.status_anggota}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tanggal Meninggal:</span>
                      <span>{new Date(claim.tanggal_meninggal).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                {/* Heir Information */}
                <div className="p-4 bg-white border rounded-lg">
                  <h5 className="font-medium mb-3">Data Ahli Waris</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Nama:</span>
                      <span className="font-medium">{claim.nama_ahli_waris}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status Hubungan:</span>
                      <span className="font-medium">{claim.status_ahli_waris}</span>
                    </div>
                    {claim.no_hp_ahli_waris && (
                      <div className="flex justify-between">
                        <span>No. HP:</span>
                        <span>{claim.no_hp_ahli_waris}</span>
                      </div>
                    )}
                    {claim.nik_ahli_waris && (
                      <div className="flex justify-between">
                        <span>NIK:</span>
                        <span>{claim.nik_ahli_waris}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Eligibility Checks */}
                <div className="md:col-span-2 p-4 bg-white border rounded-lg">
                  <h5 className="font-medium mb-3">Pemeriksaan Eligibility</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries({
                      memberStatusValid: 'Status anggota valid saat meninggal',
                      memberCategoryCorrect: 'Kategori anggota sesuai',
                      mpsStatusVerified: 'Status MPS terverifikasi',
                      heirRelationshipConfirmed: 'Hubungan ahli waris dikonfirmasi',
                      heirEligibilityVerified: 'Ahli waris eligible (suami/istri/anak)',
                      noDuplicateClaims: 'Tidak ada klaim ganda',
                      withinTimeLimit: 'Dalam batas waktu pengajuan'
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={eligibilityChecks[key as keyof typeof eligibilityChecks]}
                          onChange={(e) => setEligibilityChecks(prev => ({
                            ...prev,
                            [key]: e.target.checked
                          }))}
                          disabled={readonly}
                          className="h-4 w-4"
                        />
                        <label className="text-sm">{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calculation Tab */}
        {activeTab === 'calculation' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-5 w-5" />
                <h4 className="font-semibold">Perhitungan Dana Kematian</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Hitung dan verifikasi besaran dana kematian yang akan diberikan
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Input Parameters */}
                <div className="space-y-4">
                  <div>
                    <Label>Kategori Anggota</Label>
                    <Select value={claim.status_anggota} disabled>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pegawai">Pegawai</SelectItem>
                        <SelectItem value="pensiunan">Pensiunan</SelectItem>
                        <SelectItem value="istri">Istri</SelectItem>
                        <SelectItem value="suami">Suami</SelectItem>
                        <SelectItem value="anak">Anak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Status MPS</Label>
                    <Select value={claim.status_mps} disabled>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mps">MPS</SelectItem>
                        <SelectItem value="non_mps">Non-MPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Status Hubungan Ahli Waris</Label>
                    <Select value={claim.status_ahli_waris} disabled>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="istri">Istri</SelectItem>
                        <SelectItem value="suami">Suami</SelectItem>
                        <SelectItem value="anak">Anak</SelectItem>
                        <SelectItem value="keluarga">Keluarga Lain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Calculation Result */}
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h5 className="font-medium mb-3">Rumus Perhitungan</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Base Amount:</span>
                        <span className="font-medium">Rp 15.000.000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>MPS Multiplier:</span>
                        <span className="font-medium">{claim.status_mps === 'mps' ? '1.5x' : '1.0x'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Heir Adjustment:</span>
                        <span className="font-medium">1.0x</span>
                      </div>
                      <hr className="my-2" />
                      <div className="flex justify-between font-bold">
                        <span>Total:</span>
                        <span className="text-green-600">
                          {new Intl.NumberFormat('id-ID').format(benefitAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Besaran Dana Kematian</Label>
                    <Input
                      type="number"
                      value={benefitAmount}
                      onChange={(e) => setBenefitAmount(parseFloat(e.target.value))}
                      disabled={readonly}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Approval Tab */}
        {activeTab === 'approval' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-3">Keputusan Verifikasi</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Berdasarkan hasil verifikasi dokumen dan eligibility, tentukan keputusan untuk pengajuan ini
              </p>

              {/* Summary */}
              <div className="p-4 bg-white border rounded-lg mb-4">
                <h5 className="font-medium mb-2">Ringkasan Verifikasi</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Kelengkapan Dokumen:</span>
                    <Badge variant={verification.documents ? 'success' : 'destructive'}>
                      {verification.documents ? 'Lengkap' : 'Tidak Lengkap'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Eligibility:</span>
                    <Badge variant={verification.eligibility ? 'success' : 'destructive'}>
                      {verification.eligibility ? 'Memenuhi Syarat' : 'Tidak Memenuhi Syarat'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Besaran Dana:</span>
                    <span className="font-medium text-green-600">
                      {new Intl.NumberFormat('id-ID').format(benefitAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <Label>Catatan Verifikasi</Label>
                <Textarea
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Catatan tambahan mengenai hasil verifikasi..."
                  rows={3}
                  disabled={readonly}
                />
              </div>

              {/* Decision Options */}
              {!readonly && (
                <div className="space-y-3">
                  {verification.overall ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <h5 className="font-semibold text-green-900">Rekomendasi: Setujui</h5>
                      </div>
                      <p className="text-sm text-green-800 mb-3">
                        Dokumen lengkap dan eligibility terpenuhi. Pengajuan dapat disetujui.
                      </p>
                      <Button onClick={handleApprove} className="w-full gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Setujui Pengajuan
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <h5 className="font-semibold text-yellow-900">Perlu Verifikasi Lengkap</h5>
                      </div>
                      <p className="text-sm text-yellow-800 mb-3">
                        Ada item yang perlu diverifikasi sebelum dapat memberikan keputusan.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={handleReturnToPC}
                      className="w-full gap-1"
                    >
                      <AlertCircle className="h-4 w-4" />
                      Kembalikan ke PC
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      className="w-full gap-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Tolak Pengajuan
                    </Button>
                  </div>

                  {(rejectionCategory || rejectionReason) && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                      <div>
                        <Label>Kategori Penolakan</Label>
                        <Select
                          value={rejectionCategory}
                          onValueChange={setRejectionCategory}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih kategori" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="document">Masalah Dokumen</SelectItem>
                            <SelectItem value="eligibility">Tidak Eligible</SelectItem>
                            <SelectItem value="fraud">Indikasi Fraud</SelectItem>
                            <SelectItem value="timeout">Batas Waktu</SelectItem>
                            <SelectItem value="other">Lainnya</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Alasan Penolakan</Label>
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Jelaskan alasan penolakan secara detail..."
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {readonly && claim.status_proses === 'verified' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-900">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Pengajuan telah disetujui</span>
                  </div>
                  <p className="text-sm text-green-800 mt-1">
                    Verifikasi selesai pada {claim.waktu_3 && new Date(claim.waktu_3).toLocaleDateString('id-ID')}
                  </p>
                </div>
              )}

              {readonly && claim.status_proses === 'ditolak' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-900">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Pengajuan ditolak</span>
                  </div>
                  <p className="text-sm text-red-800 mt-1">
                    {claim.rejection_reason || 'Alasan penolakan tidak dicatat'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      {!readonly && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">Status Verifikasi: </span>
              <span className={`font-semibold ${
                verification.overall ? 'text-green-600' :
                verification.documents ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {verification.overall ? 'Siap Disetujui' :
                 verification.documents ? 'Perlu Verifikasi Eligibility' :
                 'Perlu Verifikasi Dokumen'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setActiveTab('documents')} size="sm" variant="outline">
                Verifikasi Dokumen
              </Button>
              <Button onClick={() => setActiveTab('approval')} size="sm">
                Buat Keputusan
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}