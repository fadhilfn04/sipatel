import { Anggota } from '@/lib/supabase';

export interface DocumentStatus {
  field: string;
  label: string;
  isComplete: boolean;
  value: string | null;
}

export interface DocumentCompleteness {
  totalDocuments: number;
  completedDocuments: number;
  completenessPercentage: number;
  documents: DocumentStatus[];
  isComplete: boolean;
}

// Required documents to track
const REQUIRED_DOCUMENTS = [
  { field: 'e_ktp', label: 'E-KTP' },
  { field: 'kartu_keluarga', label: 'Kartu Keluarga' },
  { field: 'npwp', label: 'NPWP' },
  { field: 'nomor_sk_pensiun', label: 'SK Pensiun' },
] as const;

/**
 * Calculate document completeness for an anggota
 */
export function calculateDocumentCompleteness(anggota: Anggota): DocumentCompleteness {
  const documents: DocumentStatus[] = REQUIRED_DOCUMENTS.map(doc => ({
    field: doc.field,
    label: doc.label,
    isComplete: Boolean(anggota[doc.field] && anggota[doc.field]!.trim().length > 0),
    value: anggota[doc.field] || null,
  }));

  const completedDocuments = documents.filter(doc => doc.isComplete).length;
  const totalDocuments = documents.length;
  const completenessPercentage = Math.round((completedDocuments / totalDocuments) * 100);

  return {
    totalDocuments,
    completedDocuments,
    completenessPercentage,
    documents,
    isComplete: completenessPercentage === 100,
  };
}

/**
 * Get document status for badge display
 */
export function getDocumentStatusBadge(completenessPercentage: number): {
  variant: 'success' | 'warning' | 'destructive' | 'secondary';
  label: string;
} {
  if (completenessPercentage === 100) {
    return { variant: 'success', label: 'Lengkap' };
  } else if (completenessPercentage >= 50) {
    return { variant: 'warning', label: `${completenessPercentage}%` };
  } else if (completenessPercentage > 0) {
    return { variant: 'destructive', label: `${completenessPercentage}%` };
  } else {
    return { variant: 'secondary', label: 'Belum Ada' };
  }
}

/**
 * Generate document download URL
 */
export function generateDocumentDownloadUrl(anggotaId: string, documentType: string): string {
  return `/api/anggota/${anggotaId}/documents?type=${documentType}`;
}