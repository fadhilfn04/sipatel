'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Upload,
  Download
} from 'lucide-react';
import { DanaKematian } from '@/lib/supabase';

interface DocumentRequirement {
  key: keyof DanaKematian;
  name: string;
  required: boolean;
  description: string;
  verified?: boolean;
  conditional?: boolean;
  condition?: string;
}

interface DocumentValidationSystemProps {
  claim: DanaKematian;
  onUpdate?: (updates: Partial<DanaKematian>) => void;
  onPreview?: (docUrl: string) => void;
  readonly?: boolean;
}

export function DocumentValidationSystem({
  claim,
  onUpdate,
  onPreview,
  readonly = false
}: DocumentValidationSystemProps) {
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  const documentRequirements: DocumentRequirement[] = [
    {
      key: 'file_surat_kematian',
      name: 'Surat Kematian',
      required: true,
      description: 'Surat kematian dari rumah sakit/instansi pemerintah',
      verified: claim.dokumen_surat_kematian_verified
    },
    {
      key: 'file_sk_pensiun',
      name: 'SK Pensiun',
      required: true,
      description: 'Surat Keputusan Pensiun dari instansi terkait',
      verified: claim.dokumen_sk_pensiun_verified
    },
    {
      key: 'file_surat_pernyataan_ahli_waris',
      name: 'Surat Pernyataan Ahli Waris',
      required: true,
      description: 'Surat pernyataan ahli waris yang ditandatangani',
      verified: claim.dokumen_surat_pernyataan_verified
    },
    {
      key: 'file_kartu_keluarga',
      name: 'Kartu Keluarga',
      required: true,
      description: 'Kartu keluarga yang mencantumkan almarhum dan ahli waris',
      verified: claim.dokumen_kartu_keluarga_verified
    },
    {
      key: 'file_e_ktp',
      name: 'E-KTP Ahli Waris',
      required: true,
      description: 'KTP elektronik ahli waris yang masih berlaku',
      verified: claim.dokumen_ktp_ahli_waris_verified
    },
    {
      key: 'file_surat_nikah',
      name: 'Surat Nikah',
      required: false,
      conditional: true,
      condition: 'Wajib jika ahli waris adalah suami/istri',
      description: 'Buku nikah atau akta pernikahan',
      verified: claim.dokumen_surat_nikah_verified
    }
  ];

  const getDocumentStatus = (doc: DocumentRequirement) => {
    const docUrl = claim[doc.key];
    const isVerified = doc.verified;

    if (!docUrl) return { status: 'missing', label: 'Belum Diunggah', icon: AlertCircle };
    if (isVerified) return { status: 'verified', label: 'Terverifikasi', icon: CheckCircle2 };
    return { status: 'uploaded', label: 'Menunggu Verifikasi', icon: FileText };
  };

  const toggleVerification = (docKey: string, verified: boolean) => {
    // Mapping dari file key ke verified field yang benar
    const verificationFieldMap: Record<string, keyof DanaKematian> = {
      'file_surat_kematian': 'dokumen_surat_kematian_verified',
      'file_sk_pensiun': 'dokumen_sk_pensiun_verified',
      'file_surat_pernyataan_ahli_waris': 'dokumen_surat_pernyataan_verified',
      'file_kartu_keluarga': 'dokumen_kartu_keluarga_verified',
      'file_e_ktp': 'dokumen_ktp_ahli_waris_verified',
      'file_surat_nikah': 'dokumen_surat_nikah_verified',
    };

    const verificationField = verificationFieldMap[docKey];
    if (!verificationField) {
      console.error(`Unknown docKey: ${docKey}`);
      return;
    }

    onUpdate?.({
      [verificationField]: verified
    } as Partial<DanaKematian>);
  };

  const getCompletenessStatus = () => {
    const requiredDocs = documentRequirements.filter(d => d.required);
    const allDocs = documentRequirements;
    const uploadedRequired = requiredDocs.filter(d => claim[d.key]);
    const verifiedRequired = requiredDocs.filter(d => claim[d.key] && d.verified);

    return {
      total: requiredDocs.length,
      totalAllDocs: allDocs.length,
      uploaded: uploadedRequired.length,
      verified: verifiedRequired.length,
      isComplete: uploadedRequired.length === requiredDocs.length,
      allVerified: verifiedRequired.length === requiredDocs.length
    };
  };

  const completeness = getCompletenessStatus();

  const toggleDocSelection = (docKey: string) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docKey)) {
      newSelected.delete(docKey);
    } else {
      newSelected.add(docKey);
    }
    setSelectedDocs(newSelected);
  };

  const verifySelected = () => {
    selectedDocs.forEach(docKey => {
      toggleVerification(docKey, true);
    });
    setSelectedDocs(new Set());
  };

  const unverifySelected = () => {
    selectedDocs.forEach(docKey => {
      toggleVerification(docKey, false);
    });
    setSelectedDocs(new Set());
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Validasi Dokumen</h3>
          <p className="text-sm text-muted-foreground">
            Kelengkapan dan verifikasi dokumen (Berkas-1 & Berkas-2)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={completeness.allVerified ? 'success' : completeness.isComplete ? 'secondary' : 'destructive'}>
            {completeness.verified}/{completeness.total} Terverifikasi
          </Badge>
          <Badge variant="secondary">
            {completeness.uploaded}/{completeness.total} Diunggah
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">Progress Dokumen</span>
          <span className="text-muted-foreground">
            {Math.round((completeness.verified / completeness.total) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              completeness.allVerified ? 'bg-green-600' :
              completeness.isComplete ? 'bg-blue-600' :
              'bg-yellow-600'
            }`}
            style={{ width: `${(completeness.verified / completeness.total) * 100}%` }}
          />
        </div>
      </div>

      {/* Bulk actions */}
      {!readonly && completeness.uploaded > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">{selectedDocs.size} dokumen dipilih</span>
            </div>
            <div className="flex gap-2">
              {selectedDocs.size > 0 && (
                <>
                  <Button onClick={verifySelected} size="sm" variant="outline">
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Verifikasi
                  </Button>
                  <Button onClick={unverifySelected} size="sm" variant="outline">
                    <XCircle className="h-4 w-4 mr-1" />
                    Batalkan
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-3">
        {documentRequirements.map((doc) => {
          const docUrl = claim[doc.key];
          const docStatus = getDocumentStatus(doc);
          const StatusIcon = docStatus.icon;
          const isSelected = selectedDocs.has(doc.key);

          return (
            <div
              key={doc.key}
              className={`p-4 border rounded-lg transition-colors ${
                isSelected ? 'bg-blue-50 border-blue-300' :
                docStatus.status === 'verified' ? 'bg-green-50 border-green-200' :
                docStatus.status === 'uploaded' ? 'bg-white border-gray-200' :
                'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Selection checkbox */}
                {!readonly && docUrl && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleDocSelection(doc.key)}
                    className="mt-1"
                  />
                )}

                {/* Status icon */}
                <div className={`p-2 rounded-lg ${
                  docStatus.status === 'verified' ? 'bg-green-100' :
                  docStatus.status === 'uploaded' ? 'bg-blue-100' :
                  'bg-red-100'
                }`}>
                  <StatusIcon className={`h-5 w-5 ${
                    docStatus.status === 'verified' ? 'text-green-600' :
                    docStatus.status === 'uploaded' ? 'text-blue-600' :
                    'text-red-600'
                  }`} />
                </div>

                {/* Document info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{doc.name}</h4>
                        {doc.required && (
                          <Badge variant="destructive" className="text-xs">Wajib</Badge>
                        )}
                        {doc.conditional && (
                          <Badge variant="secondary" className="text-xs">
                            {doc.condition}
                          </Badge>
                        )}
                        <Badge
                          variant={
                            docStatus.status === 'verified' ? 'success' :
                            docStatus.status === 'uploaded' ? 'secondary' :
                            'destructive'
                          }
                          className="text-xs"
                        >
                          {docStatus.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {doc.description}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {docUrl && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onPreview?.(docUrl as string)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!readonly && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleVerification(doc.key, !doc.verified)}
                              className="h-8 w-8 p-0"
                              title={doc.verified ? 'Batalkan verifikasi' : 'Verifikasi'}
                            >
                              {doc.verified ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                          )}
                        </>
                      )}
                      {!docUrl && !readonly && (
                        <Button size="sm" variant="outline" className="h-8 gap-1">
                          <Upload className="h-3 w-3" />
                          Upload
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="font-medium">Status Dokumen: </span>
            <span className={`font-semibold ${
              completeness.allVerified ? 'text-green-600' :
              completeness.isComplete ? 'text-blue-600' :
              'text-red-600'
            }`}>
              {completeness.allVerified ? 'Lengkap & Terverifikasi' :
               completeness.isComplete ? 'Lengkap (Perlu Verifikasi)' :
               'Belum Lengkap'}
            </span>
          </div>
          {completeness.isComplete && !completeness.allVerified && !readonly && (
            <Button size="sm" onClick={() => {
              documentRequirements.forEach(doc => {
                if (doc.required && claim[doc.key] && !doc.verified) {
                  toggleVerification(doc.key, true);
                }
              });
            }}>
              Verifikasi Semua
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Export compact version for inline use
export function DocumentValidationCompact({ claim }: { claim: DanaKematian }) {
  const requiredDocs = ['file_surat_kematian', 'file_sk_pensiun', 'file_surat_pernyataan_ahli_waris', 'file_kartu_keluarga', 'file_e_ktp'] as const;

  // Mapping dari file key ke verified field
  const verificationFieldMap: Record<string, keyof DanaKematian> = {
    'file_surat_kematian': 'dokumen_surat_kematian_verified',
    'file_sk_pensiun': 'dokumen_sk_pensiun_verified',
    'file_surat_pernyataan_ahli_waris': 'dokumen_surat_pernyataan_verified',
    'file_kartu_keluarga': 'dokumen_kartu_keluarga_verified',
    'file_e_ktp': 'dokumen_ktp_ahli_waris_verified',
  };

  const uploaded = requiredDocs.filter(d => claim[d]).length;
  const verified = requiredDocs.filter(d => {
    const verifiedField = verificationFieldMap[d];
    return claim[d] && verifiedField && claim[verifiedField];
  }).length;

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