/**
 * Dana Kematian Document Configuration
 * Centralized configuration for all document types in the death benefit claim workflow
 */

import { FileText, ScrollText, Users, UserCircle, Heart, AlertTriangle, FilePlus } from 'lucide-react';

export type DocumentStatus = 'not_uploaded' | 'uploaded' | 'verified';

export interface DocumentField {
  id: string;
  label: string;
  type: 'text' | 'date' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
  required: boolean;
}

export interface DocumentCondition {
  type: 'spouse_alive' | 'both_deceased' | 'always';
  description: string;
}

export interface AdditionalDocument {
  id: string;
  nama_dokumen: string;
  keterangan: string;
  file_url: string;
  uploaded_at: string;
}

export interface DocumentType {
  id: string;
  label: string;
  description: string;
  icon: any;
  required: boolean;
  category: 'wajib' | 'kondisional' | 'pendukung';
  fields: DocumentField[];
  condition: DocumentCondition;
  fileKey: keyof DocumentFileKeys;
  verifiedKey: keyof DocumentVerifiedKeys;
}

// Document file keys mapping
export interface DocumentFileKeys {
  file_surat_kematian: string | null;
  file_sk_pensiun: string | null;
  file_surat_pernyataan_ahli_waris: string | null;
  file_kartu_keluarga: string | null;
  file_surat_nikah: string | null;
  file_surat_keterangan: string | null;
  file_dokumen_pendukung: string | null;
}

// Document verification keys mapping
export interface DocumentVerifiedKeys {
  dokumen_surat_kematian_verified: boolean;
  dokumen_sk_pensiun_verified: boolean;
  dokumen_surat_pernyataan_verified: boolean;
  dokumen_kartu_keluarga_verified: boolean;
  dokumen_surat_nikah_verified: boolean;
  dokumen_surat_keterangan_verified: boolean;
  dokumen_dokumen_pendukung_verified: boolean;
}

export const DOCUMENT_TYPES: DocumentType[] = [
  {
    id: 'surat_kematian',
    label: 'Surat Kematian (SuKem)',
    description: 'Dokumen resmi kematian dari rumah sakit/instansi berwenang',
    icon: FileText,
    required: true,
    category: 'wajib',
    fields: [
      {
        id: 'nik_meninggal',
        label: 'NIK Meninggal',
        type: 'text',
        placeholder: 'Masukkan NIK',
        required: true,
      },
      {
        id: 'nama_meninggal',
        label: 'Nama Meninggal',
        type: 'text',
        placeholder: 'Nama lengkap sesuai KTP',
        required: true,
      },
    ],
    condition: {
      type: 'always',
      description: 'Wajib untuk semua pengajuan',
    },
    fileKey: 'file_surat_kematian',
    verifiedKey: 'dokumen_surat_kematian_verified',
  },
  {
    id: 'sk_pensiun',
    label: 'SK Pensiun',
    description: 'Surat Keputusan Pensiun dari instansi',
    icon: ScrollText,
    required: true,
    category: 'wajib',
    fields: [
      {
        id: 'nik_pemilik_sk',
        label: 'NIK Pemilik SK',
        type: 'text',
        placeholder: 'Masukkan NIK',
        required: true,
      },
      {
        id: 'susunan_keluarga',
        label: 'Susunan Keluarga',
        type: 'text',
        placeholder: 'Jelaskan susunan keluarga',
        required: false,
      },
    ],
    condition: {
      type: 'always',
      description: 'Wajib untuk semua pengajuan',
    },
    fileKey: 'file_sk_pensiun',
    verifiedKey: 'dokumen_sk_pensiun_verified',
  },
  {
    id: 'surat_ahli_waris',
    label: 'Surat Ahli Waris / Surat Kuasa',
    description: 'Dokumen yang menunjukkan ahli waris yang sah',
    icon: Users,
    required: true,
    category: 'wajib',
    fields: [
      {
        id: 'nama_ahli_waris',
        label: 'Nama Ahli Waris',
        type: 'text',
        placeholder: 'Nama lengkap ahli waris',
        required: true,
      },
      {
        id: 'hubungan',
        label: 'Hubungan dengan Meninggal',
        type: 'select',
        options: [
          { value: 'istri', label: 'Istri' },
          { value: 'suami', label: 'Suami' },
          { value: 'anak', label: 'Anak' },
          { value: 'orang_tua', label: 'Orang Tua' },
          { value: 'saudara', label: 'Saudara' },
          { value: 'lainnya', label: 'Lainnya' },
        ],
        required: true,
      },
    ],
    condition: {
      type: 'always',
      description: 'Wajib untuk semua pengajuan',
    },
    fileKey: 'file_surat_pernyataan_ahli_waris',
    verifiedKey: 'dokumen_surat_pernyataan_verified',
  },
  {
    id: 'kartu_keluarga',
    label: 'Kartu Keluarga Ahli Waris',
    description: 'KK ahli waris yang masih berlaku',
    icon: UserCircle,
    required: true,
    category: 'wajib',
    fields: [
      {
        id: 'nama_ahli_waris_kk',
        label: 'Nama Ahli Waris',
        type: 'text',
        placeholder: 'Nama sesuai KK',
        required: true,
      },
      {
        id: 'keterangan_hubungan',
        label: 'Keterangan Hubungan',
        type: 'text',
        placeholder: 'Hubungan dengan yang meninggal',
        required: true,
      },
    ],
    condition: {
      type: 'always',
      description: 'Wajib untuk semua pengajuan',
    },
    fileKey: 'file_kartu_keluarga',
    verifiedKey: 'dokumen_kartu_keluarga_verified',
  },
  {
    id: 'surat_nikah',
    label: 'Surat Nikah',
    description: 'Buku nikah atau surat keterangan nikah',
    icon: Heart,
    required: false,
    category: 'kondisional',
    fields: [],
    condition: {
      type: 'spouse_alive',
      description: 'Diperlukan jika salah satu pasangan masih hidup',
    },
    fileKey: 'file_surat_nikah',
    verifiedKey: 'dokumen_surat_nikah_verified',
  },
  {
    id: 'surat_keterangan',
    label: 'Surat Keterangan',
    description: 'Surat keterangan dari kelurahan/instansi terkait',
    icon: AlertTriangle,
    required: false,
    category: 'kondisional',
    fields: [],
    condition: {
      type: 'both_deceased',
      description: 'Diperlukan jika suami dan istri sudah meninggal',
    },
    fileKey: 'file_surat_keterangan',
    verifiedKey: 'dokumen_surat_keterangan_verified',
  },
  {
    id: 'dokumen_pendukung',
    label: 'Dokumen Pendukung Lain',
    description: 'Dokumen tambahan yang diperlukan (fleksibel)',
    icon: FilePlus,
    required: false,
    category: 'pendukung',
    fields: [],
    condition: {
      type: 'always',
      description: 'Opsional - dapat ditambahkan sesuai kebutuhan',
    },
    fileKey: 'file_dokumen_pendukung',
    verifiedKey: 'dokumen_dokumen_pendukung_verified',
  },
];

/**
 * Get document types based on category and conditions
 */
export function getDocumentTypes(options?: {
  category?: 'wajib' | 'kondisional' | 'pendukung' | 'all';
  spouseAlive?: boolean;
  bothDeceased?: boolean;
}): DocumentType[] {
  const category = options?.category || 'all';

  return DOCUMENT_TYPES.filter((doc) => {
    // Filter by category
    if (category !== 'all' && doc.category !== category) {
      return false;
    }

    // Filter by conditional logic
    if (doc.condition.type === 'spouse_alive') {
      return options?.spouseAlive === true;
    }
    if (doc.condition.type === 'both_deceased') {
      return options?.bothDeceased === true;
    }

    return true;
  });
}

/**
 * Get required documents (wajib + kondisional that apply)
 */
export function getRequiredDocuments(options?: {
  spouseAlive?: boolean;
  bothDeceased?: boolean;
}): DocumentType[] {
  return DOCUMENT_TYPES.filter((doc) => {
    if (doc.required && doc.category === 'wajib') {
      return true;
    }
    if (doc.category === 'kondisional') {
      if (doc.condition.type === 'spouse_alive') {
        return options?.spouseAlive === true;
      }
      if (doc.condition.type === 'both_deceased') {
        return options?.bothDeceased === true;
      }
    }
    return false;
  });
}

/**
 * Get document type by ID
 */
export function getDocumentTypeById(id: string): DocumentType | undefined {
  return DOCUMENT_TYPES.find((doc) => doc.id === id);
}

/**
 * Get document status based on file URL and verification flag
 */
export function getDocumentStatus(
  fileUrl: string | null,
  isVerified: boolean
): DocumentStatus {
  if (!fileUrl) return 'not_uploaded';
  if (isVerified) return 'verified';
  return 'uploaded';
}

/**
 * Calculate overall document completion percentage
 */
export function getDocumentCompletion(documents: Array<{
  fileUrl: string | null;
  isVerified: boolean;
}>): {
  uploaded: number;
  verified: number;
  total: number;
  percentage: number;
} {
  const total = documents.length;
  const uploaded = documents.filter((d) => d.fileUrl).length;
  const verified = documents.filter((d) => d.isVerified).length;

  return {
    uploaded,
    verified,
    total,
    percentage: Math.round((uploaded / total) * 100),
  };
}

/**
 * Get missing required documents
 */
export function getMissingDocuments(
  claim: Partial<Record<keyof DocumentFileKeys, string | null>>,
  options?: { spouseAlive?: boolean; bothDeceased?: boolean }
): DocumentType[] {
  const requiredDocs = getRequiredDocuments(options);

  return requiredDocs.filter((doc) => {
    const fileUrl = claim[doc.fileKey];
    return !fileUrl || fileUrl === '';
  });
}

/**
 * Get pending verification documents
 */
export function getPendingVerificationDocuments(
  claim: Partial<Record<keyof DocumentFileKeys, string | null>> & Partial<Record<keyof DocumentVerifiedKeys, boolean>>
): DocumentType[] {
  return DOCUMENT_TYPES.filter((doc) => {
    const fileUrl = claim[doc.fileKey];
    const isVerified = claim[doc.verifiedKey];
    return fileUrl && !isVerified;
  });
}

/**
 * Validate document metadata
 */
export interface DocumentMetadata {
  [documentId: string]: {
    [fieldId: string]: string;
  };
}

export function validateDocumentMetadata(
  documentType: DocumentType,
  metadata: DocumentMetadata[string]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of documentType.fields) {
    if (field.required && (!metadata || !metadata[field.id])) {
      errors.push(`${field.label} wajib diisi`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
