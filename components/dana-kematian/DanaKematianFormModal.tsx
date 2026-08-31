'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  User,
  Users,
  FileText,
  Loader2,
  Plus,
  Pencil,
  Search,
  Upload,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Circle,
  X,
  XCircle,
  Lock,
  Save,
  FolderCheck,
  Info,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DanaKematian, CreateDanaKematianInput, Anggota } from '@/lib/supabase';
import { MemberSearchModal } from './MemberSearchModal';
import { calculateTariff, formatTariffLabel, getTariffDisplayLabel } from '@/lib/utils/tariff-calculator';
import { useCurrentUserAnggota } from '@/lib/hooks/use-anggota-api';
import { getStatusProps } from '@/lib/workflow/dana-kematian-status';

interface DanaKematianFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDanaKematianInput, submitMode: 'draft' | 'lengkap') => Promise<void>;
  claim?: DanaKematian | null;
  mode: 'create' | 'edit';
  isPending: boolean;
  members: Anggota[];
  existingAnggotaIds?: Set<string>;
}

type FamilyMember = { nama: string; hubungan: string };
type DocMeta = Record<string, any>;

/** Hubungan that counts as keluarga inti → "Surat Keterangan Ahli Waris" */
const KELUARGA_INTI = ['istri', 'suami', 'anak'];

const AKTE_KEMATIAN_SOURCES = [
  { value: 'disdukcapil', label: 'DisDukCapil' },
  { value: 'rumah_sakit', label: 'Rumah Sakit' },
  { value: 'kecamatan', label: 'Kecamatan' },
  { value: 'lainnya', label: 'Lainnya' },
];

const defaultFormData: CreateDanaKematianInput = {
  nama_anggota: '',
  status_anggota: 'pegawai',
  status_mps: 'non_mps',
  tanggal_meninggal: '',
  penyebab_meninggal: '',
  tanggal_lapor_keluarga: '',
  cabang_asal_melapor: '',
  cabang_nama_pelapor: '',
  cabang_nik_pelapor: '',
  cabang_tanggal_awal_terima_berkas: '',
  cabang_tanggal_kirim_ke_pusat: '',
  pusat_tanggal_awal_terima: '',
  pusat_tanggal_validasi: '',
  pusat_tanggal_selesai: '',
  besaran_dana_kematian: 0,
  cabang_tanggal_serah_ke_ahli_waris: '',
  cabang_tanggal_lapor_ke_pusat: '',
  nama_ahli_waris: '',
  status_ahli_waris: 'anak',
  file_sk_pensiun: '',
  file_surat_kematian: '',
  file_surat_pernyataan_ahli_waris: '',
  file_kartu_keluarga: '',
  file_e_ktp: '',
  file_surat_nikah: '',
  file_surat_keterangan: '',
  file_dokumen_pendukung: '',
  susunan_keluarga: '',
  status_proses: 'draft',
  keterangan: '',
};

interface DocumentStep {
  label: string;
  shortLabel: string;
  field: keyof CreateDanaKematianInput;
  folder: string;
  description: string;
  required: boolean;
  /** Custom renderer key for step-specific inputs */
  stepKey?: 'sk_pensiun' | 'akte_kematian' | 'surat_ahli_waris' | 'kk' | 'e_ktp' | 'surat_nikah';
}

const DOCUMENT_STEPS: DocumentStep[] = [
  {
    label: 'SK Pensiun',
    shortLabel: 'SK Pensiun',
    field: 'file_sk_pensiun',
    folder: 'sk-pensiun',
    description: 'Upload Surat Keputusan Pensiun anggota yang bersangkutan. Jika dokumen hilang, berikan pernyataan resmi.',
    required: true,
    stepKey: 'sk_pensiun',
  },
  {
    label: 'Akte Kematian',
    shortLabel: 'Akte Kematian',
    field: 'file_surat_kematian',
    folder: 'surat-kematian',
    description: 'Upload akte/surat kematian resmi dan pilih sumber penerbit dokumen',
    required: true,
    stepKey: 'akte_kematian',
  },
  {
    label: 'Surat Keterangan / Surat Kuasa Ahli Waris',
    shortLabel: 'Surat Ahli Waris',
    field: 'file_surat_pernyataan_ahli_waris',
    folder: 'surat-pernyataan-ahli-waris',
    description: 'Surat Keterangan untuk keluarga inti (istri/suami/anak) atau Surat Kuasa untuk hubungan lainnya. Harus dilegalisir.',
    required: true,
    stepKey: 'surat_ahli_waris',
  },
  {
    label: 'Kartu Keluarga Ahli Waris',
    shortLabel: 'KK Ahli Waris',
    field: 'file_kartu_keluarga',
    folder: 'kartu-keluarga',
    description: 'Upload kartu keluarga ahli waris yang masih berlaku dan konfirmasi garis keturunan',
    required: true,
    stepKey: 'kk',
  },
  {
    label: 'E-KTP Ahli Waris',
    shortLabel: 'E-KTP Ahli Waris',
    field: 'file_e_ktp',
    folder: 'e-ktp',
    description: 'Upload fotokopi E-KTP ahli waris yang masih berlaku (jika E-KTP lebih dari satu, gabungkan dalam satu file PDF/kolase)',
    required: true,
    stepKey: 'e_ktp',
  },
  {
    label: 'Surat Nikah',
    shortLabel: 'Surat Nikah',
    field: 'file_surat_nikah',
    folder: 'surat-nikah',
    description: 'Upload surat nikah (diperlukan jika ahli waris istri/suami). Jika tidak ada, isi keterangan.',
    required: true,
    stepKey: 'surat_nikah',
  },
  {
    label: 'Surat Permohonan',
    shortLabel: 'Surat Permohonan',
    field: 'file_surat_keterangan',
    folder: 'surat-keterangan',
    description: 'Upload surat permohonan/pengantar resmi dari cabang — wajib untuk proses selanjutnya',
    required: true,
  },
  {
    label: 'Dokumen Pendukung',
    shortLabel: 'Dok. Pendukung',
    field: 'file_dokumen_pendukung',
    folder: 'dokumen-pendukung',
    description: 'Upload dokumen pendukung lainnya jika ada',
    required: false,
  },
];

/** Avatar initials from a person/PC name */
function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function DanaKematianFormModal({
  open,
  onClose,
  onSubmit,
  claim,
  mode,
  isPending,
  members,
  existingAnggotaIds,
}: DanaKematianFormModalProps) {
  const [formData, setFormData] = useState<CreateDanaKematianInput>(defaultFormData);
  const [docMeta, setDocMeta] = useState<DocMeta>({});
  const [activeTab, setActiveTab] = useState('informasi-utama');
  const [documentStep, setDocumentStep] = useState(0);
  const [memberSearchModalOpen, setMemberSearchModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Anggota | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [manualTariffOverride, setManualTariffOverride] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [duplicateMemberError, setDuplicateMemberError] = useState<string | null>(null);
  const [manualHeirInput, setManualHeirInput] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const uploadDocsSectionRef = useRef<HTMLDivElement>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  const addFamilyMember = () => setFamilyMembers(prev => [...prev, { nama: '', hubungan: 'anak' }]);
  const removeFamilyMember = (i: number) => setFamilyMembers(prev => prev.filter((_, idx) => idx !== i));
  const updateFamilyMember = (i: number, field: keyof FamilyMember, value: string) =>
    setFamilyMembers(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  const { data: currentUserAnggota } = useCurrentUserAnggota();

  /** Merge a metadata key and keep formData.document_metadata in sync */
  const updateMeta = (key: string, value: any) => {
    setDocMeta(prev => {
      const next = { ...prev, [key]: value };
      setFormData(f => ({ ...f, document_metadata: next }));
      return next;
    });
  };

  useEffect(() => {
    if (mode === 'edit' && claim) {
      const claimMeta: DocMeta = claim.document_metadata || {};
      setFormData({
        anggota_id: claim.anggota_id || undefined,
        nama_anggota: claim.nama_anggota,
        status_anggota: claim.status_anggota,
        status_mps: claim.status_mps,
        tanggal_meninggal: claim.tanggal_meninggal,
        penyebab_meninggal: claim.penyebab_meninggal || '',
        tanggal_lapor_keluarga: claim.tanggal_lapor_keluarga || '',
        cabang_asal_melapor: claim.cabang_asal_melapor,
        cabang_nama_pelapor: claim.cabang_nama_pelapor || '',
        cabang_nik_pelapor: claim.cabang_nik_pelapor || '',
        cabang_tanggal_awal_terima_berkas: claim.cabang_tanggal_awal_terima_berkas || '',
        cabang_tanggal_kirim_ke_pusat: claim.cabang_tanggal_kirim_ke_pusat || '',
        pusat_tanggal_awal_terima: claim.pusat_tanggal_awal_terima || '',
        pusat_tanggal_validasi: claim.pusat_tanggal_validasi || '',
        pusat_tanggal_selesai: claim.pusat_tanggal_selesai || '',
        besaran_dana_kematian: claim.besaran_dana_kematian,
        cabang_tanggal_serah_ke_ahli_waris: claim.cabang_tanggal_serah_ke_ahli_waris || '',
        cabang_tanggal_lapor_ke_pusat: claim.cabang_tanggal_lapor_ke_pusat || '',
        nama_ahli_waris: claim.nama_ahli_waris,
        status_ahli_waris: claim.status_ahli_waris,
        file_sk_pensiun: claim.file_sk_pensiun || '',
        file_surat_kematian: claim.file_surat_kematian || '',
        file_surat_pernyataan_ahli_waris: claim.file_surat_pernyataan_ahli_waris || '',
        file_kartu_keluarga: claim.file_kartu_keluarga || '',
        file_e_ktp: claim.file_e_ktp || '',
        file_surat_nikah: claim.file_surat_nikah || '',
        file_surat_keterangan: claim.file_surat_keterangan || '',
        file_dokumen_pendukung: claim.file_dokumen_pendukung || '',
        susunan_keluarga: claim.susunan_keluarga || '',
        status_proses: claim.status_proses,
        keterangan: claim.keterangan || '',
        document_metadata: claimMeta,
      });
      setDocMeta(claimMeta);

      if (claim.anggota_id) {
        const member = members.find(m => m.id === claim.anggota_id);
        if (member) setSelectedMember(member);
      }

      try {
        const parsed = JSON.parse(claim.susunan_keluarga || '[]');
        setFamilyMembers(Array.isArray(parsed) ? parsed : []);
      } catch {
        setFamilyMembers([]);
      }
    } else {
      setFormData({
        ...defaultFormData,
        cabang_nama_pelapor: currentUserAnggota?.nama_anggota ?? '',
        cabang_nik_pelapor: currentUserAnggota?.nik ?? '',
        cabang_asal_melapor: currentUserAnggota?.nama_cabang ?? '',
        cabang_tanggal_awal_terima_berkas: new Date().toISOString().split('T')[0],
      });
      setDocMeta({});
      setSelectedMember(null);
      setFamilyMembers([]);
    }

    setValidationErrors({});
    setDuplicateMemberError(null);
    setActiveTab('informasi-utama');
    setDocumentStep(0);
    setManualTariffOverride(false);
    setManualHeirInput(false);
  }, [claim, mode, open, members, currentUserAnggota]);

  useEffect(() => {
    if (mode === 'create' && formData.tanggal_meninggal && formData.status_mps && !manualTariffOverride) {
      const calculation = calculateTariff(formData.tanggal_meninggal, formData.status_mps);
      setFormData(prev => ({ ...prev, besaran_dana_kematian: calculation.amount }));
    }
  }, [formData.tanggal_meninggal, formData.status_mps, manualTariffOverride, mode]);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      susunan_keluarga: familyMembers.length > 0 ? JSON.stringify(familyMembers) : '',
    }));
  }, [familyMembers]);

  // ── Berkas Lengkap gating ──────────────────────────────────────────────────
  const namedFamilyMembers = useMemo(
    () => familyMembers.filter(m => m.nama && m.nama.trim()),
    [familyMembers]
  );

  const isKeluargaInti = KELUARGA_INTI.includes(formData.status_ahli_waris);
  const suratAhliWarisLabel = isKeluargaInti
    ? 'Surat Keterangan Ahli Waris'
    : 'Surat Kuasa Ahli Waris';

  const missingBerkasItems = useMemo(() => {
    const missing: string[] = [];
    const has = (v: any) => !!v;

    if (!has(formData.file_sk_pensiun) && !(docMeta.sk_pensiun_missing === true && docMeta.sk_pensiun_hilang_keterangan)) {
      missing.push('SK Pensiun (file atau pernyataan hilang)');
    }
    if (!has(formData.file_surat_kematian)) missing.push('Akte Kematian');
    if (!docMeta.akte_kematian_sumber) missing.push('Sumber Dokumen Akte Kematian');
    if (docMeta.akte_kematian_sumber === 'lainnya' && !docMeta.akte_kematian_sumber_lainnya) {
      missing.push('Keterangan sumber Akte Kematian (Lainnya)');
    }
    if (!has(formData.file_surat_pernyataan_ahli_waris)) missing.push(suratAhliWarisLabel);
    if (!has(formData.file_kartu_keluarga)) missing.push('KK Ahli Waris');
    if (docMeta.kk_ahli_waris_konfirmasi !== true) missing.push('Konfirmasi garis keturunan pada KK');
    if (!has(formData.file_e_ktp)) missing.push('E-KTP Ahli Waris');
    if (!has(formData.file_surat_nikah) && !docMeta.surat_nikah_keterangan) {
      missing.push('Surat Nikah atau Keterangan');
    }
    if (!has(formData.file_surat_keterangan)) missing.push('Surat Permohonan');
    return missing;
  }, [formData, docMeta, suratAhliWarisLabel]);

  const isBerkasLengkap = missingBerkasItems.length === 0;

  /** Can the form submit at all (draft/lengkap) — used for edit mode gating */
  const claimEditable = mode === 'create' ||
    ['draft', 'dilaporkan', 'verifikasi_cabang', 'pending_dokumen', 'revisi_pusat'].includes(claim?.status_proses || '');

  // ── Submit ────────────────────────────────────────────────────────────────
  const buildPayload = (submitMode: 'draft' | 'lengkap'): CreateDanaKematianInput => {
    const today = new Date().toISOString().split('T')[0];
    if (submitMode === 'lengkap') {
      return {
        ...formData,
        document_metadata: docMeta,
        status_proses: 'proses_pusat',
        cabang_tanggal_kirim_ke_pusat: formData.cabang_tanggal_kirim_ke_pusat || today,
      };
    }
    // Draft keeps the existing status in edit mode; new submissions start as draft
    return {
      ...formData,
      document_metadata: docMeta,
      status_proses: mode === 'edit' ? formData.status_proses : 'draft',
    };
  };

  const validateForDraft = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (mode === 'create' && !selectedMember) {
      errors.member = 'Silakan pilih anggota terlebih dahulu';
    }
    if (!formData.nama_ahli_waris) {
      errors.nama_ahli_waris = 'Nama ahli waris wajib diisi';
    }
    return errors;
  };

  const validateForLengkap = (): Record<string, string> => {
    const errors = validateForDraft();
    if (!formData.tanggal_meninggal) {
      errors.tanggal_meninggal = 'Tanggal meninggal wajib diisi';
    }
    if (!formData.cabang_asal_melapor) {
      errors.cabang_asal_melapor = 'Cabang pelapor wajib diisi';
    }
    if (!formData.cabang_tanggal_awal_terima_berkas) {
      errors.cabang_tanggal_awal_terima_berkas = 'Tanggal terima berkas wajib diisi';
    }
    if (missingBerkasItems.length > 0) {
      errors.berkas = `Dokumen belum lengkap: ${missingBerkasItems.join(', ')}`;
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Form submit = Simpan Draft. Berkas Lengkap is a separate button.
    const errors = validateForDraft();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setActiveTab('informasi-utama');
      return;
    }
    await onSubmit(buildPayload('draft'), 'draft');
  };

  const handleSubmitBerkasLengkap = async () => {
    const errors = validateForLengkap();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Navigate to the tab that contains the first error
      const dokumenTabFields = ['cabang_asal_melapor', 'cabang_tanggal_awal_terima_berkas', 'berkas', 'tanggal_meninggal'];
      const hasInformasiError = ['member', 'nama_ahli_waris'].some(f => errors[f]);
      const hasDokumenError = dokumenTabFields.some(f => errors[f]);
      if (hasDokumenError && !hasInformasiError) {
        setActiveTab('workspace-dokumen');
      } else {
        setActiveTab('informasi-utama');
      }
      return;
    }
    await onSubmit(buildPayload('lengkap'), 'lengkap');
  };

  const handleMemberSelect = (member: Anggota) => {
    if (existingAnggotaIds?.has(member.id)) {
      setDuplicateMemberError(
        `${member.nama_anggota} sudah memiliki pengajuan dana kematian yang aktif. Satu anggota hanya dapat memiliki satu pengajuan.`
      );
      setMemberSearchModalOpen(false);
      return;
    }

    setDuplicateMemberError(null);
    setSelectedMember(member);
    setFormData({
      ...formData,
      anggota_id: member.id,
      nama_anggota: member.nama_anggota,
      status_anggota: member.status_anggota,
      status_mps: member.status_mps,
      cabang_asal_melapor: member.nama_cabang,
      status_proses: 'draft',
    });

    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.member;
      return newErrors;
    });

    setManualTariffOverride(false);
  };

  const handleFieldChange = (field: keyof CreateDanaKematianInput, value: any) => {
    setFormData({ ...formData, [field]: value });

    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleFileSelect = async (
    field: keyof CreateDanaKematianInput,
    folder: string,
    file: File
  ) => {
    setUploadingField(field as string);
    setUploadErrors(prev => { const e = { ...prev }; delete e[field as string]; return e; });

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'dana-kematian');
      fd.append('folder', folder);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Upload gagal');

      handleFieldChange(field, json.url);
    } catch (err) {
      setUploadErrors(prev => ({
        ...prev,
        [field as string]: err instanceof Error ? err.message : 'Upload gagal',
      }));
    } finally {
      setUploadingField(null);
    }
  };

  const currentDocStep = DOCUMENT_STEPS[documentStep];

  /** Step completion counts substituted docs (SK Pensiun missing statement, nikah remark) */
  const isStepComplete = (step: DocumentStep): boolean => {
    if (hasFileValue(step.field)) return true;
    if (step.stepKey === 'sk_pensiun') {
      return docMeta.sk_pensiun_missing === true && !!docMeta.sk_pensiun_hilang_keterangan;
    }
    if (step.stepKey === 'surat_nikah') {
      return !!docMeta.surat_nikah_keterangan;
    }
    return false;
  };

  const hasFileValue = (field: keyof CreateDanaKematianInput) => !!(formData[field] as string);

  const title = mode === 'create' ? 'Formulir Pengajuan Dana Kematian' : 'Edit Data Dana Kematian';
  const description = mode === 'create'
    ? 'Isi formulir di bawah ini. Gunakan Simpan Draft untuk menyimpan sementara (status Draft), atau Berkas Lengkap saat 6 dokumen wajib sudah lengkap untuk dikirim ke Verifikasi Pusat.'
    : 'Ubah data pengajuan dana kematian. Status proses dikelola otomatis melalui workflow.';

  const reporterName = formData.cabang_nama_pelapor || currentUserAnggota?.nama_anggota || '';
  const reporterNik = formData.cabang_nik_pelapor || currentUserAnggota?.nik || '';
  const reporterCabang = formData.cabang_asal_melapor || currentUserAnggota?.nama_cabang || '';

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-screen h-screen max-w-[100vw] max-h-screen p-6 gap-0 overflow-hidden flex flex-col rounded-none">
          <DialogHeader className="shrink-0 px-2 pb-4">
            <DialogTitle className="text-2xl">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              {/* Tabs Header */}
              <TabsList className="shrink-0 grid grid-cols-2 w-full h-auto p-1 bg-muted mb-4 mx-2">
                <TabsTrigger value="informasi-utama" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Informasi</span>
                </TabsTrigger>
                <TabsTrigger value="workspace-dokumen" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Dokumen</span>
                </TabsTrigger>
              </TabsList>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto px-2">
                <div className="p-6">

                  {/* Tab 1: Informasi Utama */}
                  <TabsContent value="informasi-utama" className="mt-0 space-y-6">

                    {/* Informasi Pelapor — auto-populated from the logged-in user */}
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-950/80">
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2 dark:text-slate-100">
                        <Info className="h-4 w-4" />
                        Informasi Pelapor
                      </h4>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">
                            {getInitials(reporterCabang ? `PC ${reporterCabang}` : reporterName)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Nama Pelapor</p>
                            <p className="text-sm font-semibold truncate">{reporterName || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">NIK Pelapor</p>
                            <p className="text-sm font-mono truncate">{reporterNik || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Profil</p>
                            <p className="text-sm font-semibold truncate">
                              {reporterCabang ? `PC_${reporterCabang.replace(/\s+/g, '_')}` : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Data pelapor diisi otomatis dari akun yang sedang login.
                      </p>
                    </div>

                    {/* Member Search Section - Only in create mode */}
                    {mode === 'create' && (
                      <div className="rounded-lg border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-950/80">
                        <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2 dark:text-slate-100">
                          <Search className="h-4 w-4" />
                          Pilih Data Anggota
                        </h4>

                        {!selectedMember ? (
                          <div>
                            <Button
                              type="button"
                              onClick={() => setMemberSearchModalOpen(true)}
                              className="w-full"
                            >
                              <Search className="h-4 w-4 mr-2" />
                              Cari Anggota
                            </Button>
                            {duplicateMemberError && (
                              <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2.5">
                                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                <p className="text-sm text-destructive">{duplicateMemberError}</p>
                              </div>
                            )}
                            {validationErrors.member && !duplicateMemberError && (
                              <p className="text-sm text-destructive mt-2">{validationErrors.member}</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <User className="h-5 w-5 text-blue-600" />
                                <div>
                                  <p className="font-semibold text-blue-900">{selectedMember.nama_anggota}</p>
                                  <p className="text-sm text-blue-700">NIK: {selectedMember.nik}</p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedMember(null);
                                  setFormData({
                                    ...formData,
                                    anggota_id: undefined,
                                    nama_anggota: '',
                                    status_anggota: 'pegawai',
                                    status_mps: 'non_mps',
                                    cabang_asal_melapor: '',
                                  });
                                }}
                              >
                                Ganti
                              </Button>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="outline">{selectedMember.nama_cabang}</Badge>
                              <Badge>{selectedMember.status_anggota}</Badge>
                              <Badge variant="secondary">{selectedMember.status_mps}</Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Auto-filled Member Data (Readonly) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">NIK</label>
                        <Input
                          value={selectedMember?.nik || (claim as any)?.anggota?.nik || ''}
                          readOnly
                          className="bg-muted cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nama Anggota *</label>
                        <Input
                          placeholder="Nama lengkap anggota"
                          value={formData.nama_anggota}
                          onChange={(e) => handleFieldChange('nama_anggota', e.target.value)}
                          required
                          readOnly={!!selectedMember}
                          className={selectedMember ? 'bg-muted cursor-not-allowed' : ''}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Cabang</label>
                        <Input
                          value={selectedMember?.nama_cabang || ''}
                          readOnly
                          className="bg-muted cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Status Anggota *</label>
                        <Select
                          value={formData.status_anggota}
                          onValueChange={(value) => handleFieldChange('status_anggota', value)}
                          required
                          disabled={!!selectedMember}
                        >
                          <SelectTrigger className={selectedMember ? 'bg-muted cursor-not-allowed' : ''}>
                            <SelectValue placeholder="Pilih status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pegawai">Pegawai</SelectItem>
                            <SelectItem value="istri">Istri</SelectItem>
                            <SelectItem value="suami">Suami</SelectItem>
                            <SelectItem value="anak">Anak</SelectItem>
                            <SelectItem value="meninggal">Meninggal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Status MPS *</label>
                        <Select
                          value={formData.status_mps}
                          onValueChange={(value) => handleFieldChange('status_mps', value)}
                          required
                          disabled={!!selectedMember}
                        >
                          <SelectTrigger className={selectedMember ? 'bg-muted cursor-not-allowed' : ''}>
                            <SelectValue placeholder="Pilih status MPS" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mps">MPS</SelectItem>
                            <SelectItem value="non_mps">Non-MPS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Status Pengajuan</label>
                        <Input
                          value={getStatusProps(formData.status_proses).label.toUpperCase()}
                          readOnly
                          className="bg-muted cursor-not-allowed"
                        />
                        <p className="text-xs text-muted-foreground">
                          Status akan otomatis berubah sesuai workflow
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Dokumen */}
                  <TabsContent value="workspace-dokumen" className="mt-0 space-y-8">

                    {/* Forms from Detail, Pelaporan, Proses tabs */}
                    <div className="space-y-6">
                      {/* Detail & Pelaporan */}
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          Informasi Pelaporan
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Cabang Pelapor *</label>
                            <Input
                              value={formData.cabang_asal_melapor}
                              readOnly
                              className="bg-muted cursor-not-allowed"
                            />
                            {validationErrors.cabang_asal_melapor && (
                              <p className="text-sm text-destructive">{validationErrors.cabang_asal_melapor}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Nama Pelapor</label>
                            <Input
                              value={formData.cabang_nama_pelapor}
                              readOnly
                              className="bg-muted cursor-not-allowed"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">NIK Pelapor</label>
                            <Input
                              value={formData.cabang_nik_pelapor}
                              readOnly
                              className="bg-muted cursor-not-allowed"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Tanggal Terima Berkas dari Ahli Waris *
                            </label>
                            <Input
                              type="date"
                              value={formData.cabang_tanggal_awal_terima_berkas}
                              onChange={(e) => handleFieldChange('cabang_tanggal_awal_terima_berkas', e.target.value)}
                              required
                            />
                            {validationErrors.cabang_tanggal_awal_terima_berkas && (
                              <p className="text-sm text-destructive">
                                {validationErrors.cabang_tanggal_awal_terima_berkas}
                              </p>
                            )}
                          </div>
                          {mode === 'edit' && (
                            <>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Tanggal Kirim ke Pusat</label>
                                <Input
                                  type="date"
                                  value={formData.cabang_tanggal_kirim_ke_pusat}
                                  onChange={(e) => handleFieldChange('cabang_tanggal_kirim_ke_pusat', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-1.5">
                                  Tanggal Serah ke Ahli Waris
                                  {claim?.status_proses !== 'selesai' && (
                                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </label>
                                <Input
                                  type="date"
                                  value={formData.cabang_tanggal_serah_ke_ahli_waris}
                                  readOnly={claim?.status_proses !== 'selesai'}
                                  disabled={claim?.status_proses !== 'selesai'}
                                  className={claim?.status_proses !== 'selesai' ? 'bg-muted cursor-not-allowed opacity-60' : ''}
                                  onChange={(e) => claim?.status_proses === 'selesai' && handleFieldChange('cabang_tanggal_serah_ke_ahli_waris', e.target.value)}
                                />
                                {claim?.status_proses !== 'selesai' && (
                                  <p className="text-xs text-muted-foreground">Otomatis terisi saat konfirmasi transfer selesai</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-1.5">
                                  Tanggal Lapor ke Pusat
                                  {claim?.status_proses !== 'selesai' && (
                                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </label>
                                <Input
                                  type="date"
                                  value={formData.cabang_tanggal_lapor_ke_pusat}
                                  readOnly={claim?.status_proses !== 'selesai'}
                                  disabled={claim?.status_proses !== 'selesai'}
                                  className={claim?.status_proses !== 'selesai' ? 'bg-muted cursor-not-allowed opacity-60' : ''}
                                  onChange={(e) => claim?.status_proses === 'selesai' && handleFieldChange('cabang_tanggal_lapor_ke_pusat', e.target.value)}
                                />
                                {claim?.status_proses !== 'selesai' && (
                                  <p className="text-xs text-muted-foreground">Otomatis terisi saat konfirmasi transfer selesai</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Keterangan */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Keterangan</label>
                        <Textarea
                          placeholder="Keterangan tambahan mengenai pengajuan"
                          value={formData.keterangan}
                          onChange={(e) => handleFieldChange('keterangan', e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>

                    {/* Divider */}
                    <div ref={uploadDocsSectionRef} className="border-t pt-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-6">
                        Upload Dokumen Persyaratan
                      </h3>

                      {/* Stepper Header */}
                      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
                        {DOCUMENT_STEPS.map((step, index) => {
                          const completed = isStepComplete(step);
                          const isActive = index === documentStep;
                          const isPast = index < documentStep;

                          return (
                            <div key={step.field} className="flex items-center flex-1 min-w-0">
                              {/* Step button */}
                              <button
                                type="button"
                                onClick={() => setDocumentStep(index)}
                                className="flex flex-col items-center gap-1.5 flex-shrink-0"
                              >
                                <div
                                  className={`
                                    w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all font-semibold text-sm
                                    ${completed
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : isActive
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : 'bg-background border-muted-foreground/30 text-muted-foreground'
                                    }
                                  `}
                                >
                                  {completed
                                    ? <CheckCircle2 className="h-5 w-5" />
                                    : <span>{index + 1}</span>
                                  }
                                </div>
                                <span
                                  className={`text-xs font-medium text-center leading-tight max-w-16 ${
                                    isActive ? 'text-primary' : completed ? 'text-green-600' : 'text-muted-foreground'
                                  }`}
                                >
                                  {step.shortLabel}
                                  {step.required && <span className="text-destructive"> *</span>}
                                </span>
                              </button>

                              {/* Connector line */}
                              {index < DOCUMENT_STEPS.length - 1 && (
                                <div
                                  className={`flex-1 h-0.5 mx-2 -mt-5 transition-colors ${
                                    isPast || completed ? 'bg-green-400' : 'bg-muted-foreground/20'
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Step Content Card */}
                      <div className="border rounded-xl p-6 bg-card shadow-sm space-y-5">
                        {/* Step header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Langkah {documentStep + 1} dari {DOCUMENT_STEPS.length}
                              </span>
                              {currentDocStep.required && (
                                <Badge variant="destructive" className="text-xs px-1.5 py-0">Wajib</Badge>
                              )}
                              {!currentDocStep.required && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0">Opsional</Badge>
                              )}
                            </div>
                            <h4 className="text-lg font-semibold">
                              {currentDocStep.stepKey === 'surat_ahli_waris'
                                ? suratAhliWarisLabel
                                : currentDocStep.label}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-0.5">{currentDocStep.description}</p>
                          </div>
                          {isStepComplete(currentDocStep) && (
                            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 shrink-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Terupload
                            </Badge>
                          )}
                        </div>

                        {/* Step-specific input fields */}
                        {currentDocStep.stepKey === 'sk_pensiun' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">NIK</label>
                              <Input
                                value={selectedMember?.nik || (claim as any)?.anggota?.nik || ''}
                                readOnly
                                className="bg-muted cursor-not-allowed"
                                placeholder="Pilih anggota untuk mengisi NIK"
                              />
                            </div>

                            {/* Family hierarchy (source for the heir list from SK Pensiun data) */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <label className="text-sm font-medium">Susunan Keluarga</label>
                                  <p className="text-xs text-muted-foreground">
                                    Daftar keluarga dari data SK Pensiun — digunakan untuk memilih ahli waris
                                  </p>
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={addFamilyMember}>
                                  <Plus className="h-3.5 w-3.5 mr-1" />
                                  Tambah
                                </Button>
                              </div>

                              {/* Deceased header */}
                              {(formData.nama_anggota || selectedMember) && (
                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/8 border border-primary/20">
                                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                                    <User className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{formData.nama_anggota}</p>
                                    <p className="text-xs text-muted-foreground">Almarhum / Almarhumah</p>
                                  </div>
                                </div>
                              )}

                              {/* Connector line */}
                              {familyMembers.length > 0 && (
                                <div className="flex justify-center">
                                  <div className="w-0.5 h-4 bg-border" />
                                </div>
                              )}

                              {familyMembers.length === 0 ? (
                                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                  <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                                  <p className="text-sm text-muted-foreground">Belum ada anggota keluarga ditambahkan</p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-3"
                                    onClick={addFamilyMember}
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Tambah Anggota Keluarga
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {/* Column header */}
                                  <div className="grid grid-cols-[24px_1fr_160px_32px] gap-2 px-3 text-xs font-medium text-muted-foreground">
                                    <span>Tidak</span>
                                    <span>Nama</span>
                                    <span>Hubungan</span>
                                    <span />
                                  </div>
                                  {familyMembers.map((member, index) => (
                                    <div
                                      key={index}
                                      className="grid grid-cols-[24px_1fr_160px_32px] items-center gap-2 px-3 py-2 border rounded-lg bg-muted/30"
                                    >
                                      <span className="text-xs text-muted-foreground text-center">{index + 1}</span>
                                      <Input
                                        placeholder="Nama anggota keluarga"
                                        value={member.nama}
                                        onChange={(e) => updateFamilyMember(index, 'nama', e.target.value)}
                                        className="h-8 text-sm"
                                      />
                                      <Select
                                        value={member.hubungan}
                                        onValueChange={(v) => updateFamilyMember(index, 'hubungan', v)}
                                      >
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue placeholder="Hubungan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="istri">Istri</SelectItem>
                                          <SelectItem value="suami">Suami</SelectItem>
                                          <SelectItem value="anak">Anak</SelectItem>
                                          <SelectItem value="ayah">Ayah</SelectItem>
                                          <SelectItem value="ibu">Ibu</SelectItem>
                                          <SelectItem value="saudara">Saudara</SelectItem>
                                          <SelectItem value="menantu">Menantu</SelectItem>
                                          <SelectItem value="cucu">Cucu</SelectItem>
                                          <SelectItem value="lainnya">Lainnya</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <button
                                        type="button"
                                        onClick={() => removeFamilyMember(index)}
                                        className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* SK Pensiun hilang → pernyataan resmi */}
                            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                              <div className="flex items-start gap-2.5">
                                <Checkbox
                                  id="sk-pensiun-missing"
                                  checked={docMeta.sk_pensiun_missing === true}
                                  onCheckedChange={(checked) => {
                                    updateMeta('sk_pensiun_missing', checked === true);
                                    if (checked !== true) {
                                      updateMeta('sk_pensiun_hilang_keterangan', '');
                                    }
                                  }}
                                  className="mt-0.5"
                                />
                                <div>
                                  <label htmlFor="sk-pensiun-missing" className="text-sm font-medium cursor-pointer">
                                    SK Pensiun hilang / tidak dapat ditemukan
                                  </label>
                                  <p className="text-xs text-muted-foreground">
                                    Centang jika dokumen tidak ada — berikan pernyataan resmi sebagai pengganti.
                                  </p>
                                </div>
                              </div>
                              {docMeta.sk_pensiun_missing === true && (
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">
                                    Pernyataan Resmi / Penjelasan <span className="text-destructive">*</span>
                                  </label>
                                  <Textarea
                                    placeholder="Contoh: SK Pensiun almarhum hilang karena banjir. Surat keterangan kehilangan dari kelurahan terlampir."
                                    value={docMeta.sk_pensiun_hilang_keterangan || ''}
                                    onChange={(e) => updateMeta('sk_pensiun_hilang_keterangan', e.target.value)}
                                    rows={3}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Pernyataan ini akan diperiksa oleh Pusat pada tahap verifikasi.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {currentDocStep.stepKey === 'akte_kematian' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">NIK</label>
                              <Input
                                value={selectedMember?.nik || (claim as any)?.anggota?.nik || ''}
                                readOnly
                                className="bg-muted cursor-not-allowed"
                                placeholder="Pilih anggota untuk mengisi NIK"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Nama Meninggal</label>
                              <Input
                                placeholder="Nama yang meninggal"
                                value={formData.nama_anggota}
                                onChange={(e) => handleFieldChange('nama_anggota', e.target.value)}
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium">Tanggal Meninggal *</label>
                              <Input
                                type="date"
                                value={formData.tanggal_meninggal}
                                onChange={(e) => handleFieldChange('tanggal_meninggal', e.target.value)}
                                required
                              />
                              {validationErrors.tanggal_meninggal && (
                                <p className="text-sm text-destructive">{validationErrors.tanggal_meninggal}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                Sumber Dokumen <span className="text-destructive">*</span>
                              </label>
                              <Select
                                value={docMeta.akte_kematian_sumber || ''}
                                onValueChange={(value) => {
                                  updateMeta('akte_kematian_sumber', value);
                                  if (value !== 'lainnya') {
                                    updateMeta('akte_kematian_sumber_lainnya', '');
                                  }
                                }}
                                required
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih sumber dokumen" />
                                </SelectTrigger>
                                <SelectContent>
                                  {AKTE_KEMATIAN_SOURCES.map(s => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {docMeta.akte_kematian_sumber === 'lainnya' && (
                                <Input
                                  placeholder="Sebutkan sumber lainnya"
                                  value={docMeta.akte_kematian_sumber_lainnya || ''}
                                  onChange={(e) => updateMeta('akte_kematian_sumber_lainnya', e.target.value)}
                                />
                              )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                              <label className="text-sm font-medium">Besaran Dana Kematian *</label>
                              <Select
                                value={formData.besaran_dana_kematian.toString()}
                                onValueChange={(value) => {
                                  if (value !== 'auto') setManualTariffOverride(true);
                                  handleFieldChange(
                                    'besaran_dana_kematian',
                                    value === 'auto'
                                      ? calculateTariff(formData.tanggal_meninggal || '', formData.status_mps).amount
                                      : parseFloat(value)
                                  );
                                }}
                                required
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih besaran dana" />
                                </SelectTrigger>
                                <SelectContent>
                                  {mode === 'create' && formData.tanggal_meninggal && (
                                    <SelectItem value="auto">
                                      <div className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-yellow-500" />
                                        <span>
                                          Otomatis ({formatTariffLabel(calculateTariff(formData.tanggal_meninggal, formData.status_mps).amount)})
                                        </span>
                                      </div>
                                    </SelectItem>
                                  )}
                                  <SelectItem value="1500000">Rp 1.500.000</SelectItem>
                                  <SelectItem value="2000000">Rp 2.000.000</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {mode === 'create' && !manualTariffOverride && formData.tanggal_meninggal
                                  ? `⚡ Otomatis dihitung berdasarkan tanggal meninggal (${getTariffDisplayLabel(calculateTariff(formData.tanggal_meninggal, formData.status_mps).tariffType)})`
                                  : 'Tarif dana kematian berdasarkan tanggal meninggal dan status MPS'
                                }
                              </p>
                            </div>
                          </div>
                        )}

                        {currentDocStep.stepKey === 'surat_ahli_waris' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                Nama Ahli Waris {namedFamilyMembers.length > 0 && <span className="text-xs text-muted-foreground font-normal">(dari data SK Pensiun)</span>}
                              </label>
                              {namedFamilyMembers.length > 0 && !manualHeirInput ? (
                                <div className="space-y-2">
                                  <Select
                                    value={namedFamilyMembers.some(m => m.nama === formData.nama_ahli_waris)
                                      ? formData.nama_ahli_waris
                                      : '__manual__'}
                                    onValueChange={(value) => {
                                      if (value === '__manual__') {
                                        setManualHeirInput(true);
                                      } else {
                                        handleFieldChange('nama_ahli_waris', value);
                                        const match = namedFamilyMembers.find(m => m.nama === value);
                                        if (match) handleFieldChange('status_ahli_waris', match.hubungan as any);
                                      }
                                    }}
                                    required
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Pilih nama ahli waris" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {namedFamilyMembers.map((m, i) => (
                                        <SelectItem key={i} value={m.nama}>
                                          {m.nama} {m.hubungan ? `(${m.hubungan})` : ''}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="__manual__">— Ketik Manual —</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <Input
                                    placeholder="Nama lengkap ahli waris"
                                    value={formData.nama_ahli_waris}
                                    onChange={(e) => handleFieldChange('nama_ahli_waris', e.target.value)}
                                  />
                                  {namedFamilyMembers.length > 0 && (
                                    <button
                                      type="button"
                                      className="text-xs text-primary hover:underline"
                                      onClick={() => setManualHeirInput(false)}
                                    >
                                      Pilih dari daftar keluarga (SK Pensiun)
                                    </button>
                                  )}
                                </div>
                              )}
                              {validationErrors.nama_ahli_waris && (
                                <p className="text-sm text-destructive">{validationErrors.nama_ahli_waris}</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Hubungan Dengan Meninggal</label>
                              <Select
                                value={formData.status_ahli_waris}
                                onValueChange={(value) => handleFieldChange('status_ahli_waris', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih hubungan" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="istri">Istri</SelectItem>
                                  <SelectItem value="suami">Suami</SelectItem>
                                  <SelectItem value="anak">Anak</SelectItem>
                                  <SelectItem value="keluarga">Keluarga</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {isKeluargaInti
                                  ? 'Keluarga inti — dokumen berupa Surat Keterangan Ahli Waris'
                                  : 'Bukan keluarga inti — dokumen berupa Surat Kuasa Ahli Waris'}
                              </p>
                            </div>
                          </div>
                        )}

                        {currentDocStep.stepKey === 'kk' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Nama Ahli Waris</label>
                              <Input
                                value={formData.nama_ahli_waris}
                                readOnly
                                className="bg-muted cursor-not-allowed"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Hubungan Dengan Meninggal</label>
                              <Input
                                value={formData.status_ahli_waris
                                  ? formData.status_ahli_waris.charAt(0).toUpperCase() + formData.status_ahli_waris.slice(1)
                                  : ''}
                                readOnly
                                className="bg-muted cursor-not-allowed"
                                placeholder="Diisi otomatis dari Hubungan Ahli Waris"
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-4">
                                <Checkbox
                                  id="kk-ahli-waris-konfirmasi"
                                  checked={docMeta.kk_ahli_waris_konfirmasi === true}
                                  onCheckedChange={(checked) => updateMeta('kk_ahli_waris_konfirmasi', checked === true)}
                                  className="mt-0.5"
                                />
                                <label htmlFor="kk-ahli-waris-konfirmasi" className="text-sm cursor-pointer">
                                  Saya menyatakan ahli waris tercatat dalam Kartu Keluarga ini dan merupakan
                                  <span className="font-semibold"> garis keturunan langsung</span> dari almarhum/almarhumah. <span className="text-destructive">*</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentDocStep.stepKey === 'e_ktp' && (
                          <div className="space-y-2">
                            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/40">
                              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                              <p className="text-xs text-blue-800 dark:text-blue-300">
                                Pastikan <strong>nama pada E-KTP sesuai dengan nama ahli waris yang diinput</strong>
                                {formData.nama_ahli_waris && (
                                  <> — yaitu <strong>{formData.nama_ahli_waris}</strong></>
                                )}. Jika tidak sesuai, pembaruan dokumen akan diminta pada tahap verifikasi.
                              </p>
                            </div>
                          </div>
                        )}

                        {currentDocStep.stepKey === 'surat_nikah' && (
                          <div className="space-y-3">
                            <div className="rounded-lg border bg-muted/30 p-4">
                              <p className="text-sm text-muted-foreground">
                                Surat nikah sering kali tidak ditemukan atau status perkawinan tidak jelas.
                                Jika dokumen tidak dapat diupload, isi <strong>Keterangan</strong> di bawah sebagai pengganti.
                              </p>
                            </div>
                            {!hasFileValue('file_surat_nikah') && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">
                                  Keterangan <span className="text-destructive">*</span> (wajib jika dokumen tidak diupload)
                                </label>
                                <Textarea
                                  placeholder="Contoh: Buku nikah hilang terbakar saat kebakaran rumah. Surat keterangan belum menikah lagi dari kelurahan terlampir."
                                  value={docMeta.surat_nikah_keterangan || ''}
                                  onChange={(e) => updateMeta('surat_nikah_keterangan', e.target.value)}
                                  rows={3}
                                />
                              </div>
                            )}
                            {hasFileValue('file_surat_nikah') && (
                              <p className="text-xs text-muted-foreground">
                                Dokumen terupload — keterangan opsional tidak diperlukan.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Berkas completeness checklist */}
                        {(() => {
                          const allDone = isBerkasLengkap;
                          return (
                            <div className={`rounded-lg border p-4 space-y-3 ${allDone ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'}`}>
                              <div className="flex items-start gap-2.5">
                                {allDone
                                  ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                                  : <Circle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                }
                                <div className="space-y-1">
                                  <p className={`text-sm font-semibold ${allDone ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                                    {allDone
                                      ? 'Berkas lengkap — siap dikirim ke Verifikasi Pusat'
                                      : `Berkas belum lengkap (${missingBerkasItems.length} item tersisa)`
                                    }
                                  </p>
                                  <p className={`text-xs ${allDone ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                    {allDone
                                      ? 'Klik tombol "Berkas Lengkap" untuk mengirim pengajuan ke Verifikasi Pusat.'
                                      : 'Lengkapi item berikut sebelum mengirim ke Verifikasi Pusat. Atau gunakan "Simpan Draft" untuk menyimpan sementara.'
                                    }
                                  </p>
                                </div>
                              </div>

                              {/* Missing items checklist */}
                              {!allDone && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-current/10">
                                  {missingBerkasItems.map((item) => (
                                    <div key={item} className="flex items-center gap-1.5">
                                      <Circle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                      <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{item}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* File Upload Zone */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Dokumen {currentDocStep.stepKey === 'surat_ahli_waris' ? suratAhliWarisLabel : currentDocStep.label}
                          </label>
                          <div
                            className={`
                              border-2 border-dashed rounded-lg p-8 text-center transition-all
                              ${uploadingField === currentDocStep.field
                                ? 'border-primary/50 bg-primary/5 cursor-wait'
                                : uploadErrors[currentDocStep.field]
                                  ? 'border-destructive/50 bg-destructive/5 cursor-pointer hover:bg-destructive/10'
                                  : (formData[currentDocStep.field] as string)
                                    ? 'border-green-400 bg-green-50 hover:bg-green-100 cursor-pointer'
                                    : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5 cursor-pointer'
                              }
                            `}
                            onClick={() => {
                              if (uploadingField !== currentDocStep.field) {
                                fileInputRefs.current[currentDocStep.field]?.click();
                              }
                            }}
                          >
                            <input
                              ref={(el) => { fileInputRefs.current[currentDocStep.field] = el; }}
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(currentDocStep.field, currentDocStep.folder, file);
                                // Reset so the same file can be re-selected after an error
                                e.target.value = '';
                              }}
                            />

                            {uploadingField === currentDocStep.field ? (
                              <div className="space-y-2">
                                <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
                                <p className="font-medium text-primary">Mengupload dokumen...</p>
                              </div>
                            ) : uploadErrors[currentDocStep.field] ? (
                              <div className="space-y-2">
                                <Upload className="h-10 w-10 mx-auto text-destructive/60" />
                                <p className="font-medium text-destructive">
                                  {uploadErrors[currentDocStep.field]}
                                </p>
                                <p className="text-xs text-destructive/70">Klik untuk coba lagi</p>
                              </div>
                            ) : (formData[currentDocStep.field] as string) ? (
                              <div className="space-y-2">
                                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
                                <p className="font-medium text-green-700 text-sm break-all">
                                  {(() => {
                                    const url = formData[currentDocStep.field] as string;
                                    try { return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? url); }
                                    catch { return url; }
                                  })()}
                                </p>
                                <p className="text-xs text-green-600">Klik untuk mengganti dokumen</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Upload className="h-10 w-10 mx-auto text-muted-foreground/50" />
                                <p className="font-medium text-muted-foreground">
                                  Klik untuk upload {currentDocStep.stepKey === 'surat_ahli_waris' ? suratAhliWarisLabel : currentDocStep.label}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Format: PDF, JPG, PNG (maks. 5MB)
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step Navigation */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDocumentStep(prev => Math.max(0, prev - 1))}
                            disabled={documentStep === 0}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Sebelumnya
                          </Button>

                          <span className="text-xs text-muted-foreground">
                            {DOCUMENT_STEPS.filter(s => isStepComplete(s)).length} / {DOCUMENT_STEPS.length} dokumen terupload
                          </span>

                          {documentStep < DOCUMENT_STEPS.length - 1 ? (
                            <Button
                              type="button"
                              onClick={() => {
                                setDocumentStep(prev => Math.min(DOCUMENT_STEPS.length - 1, prev + 1));
                                uploadDocsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }}
                            >
                              Selanjutnya
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          ) : (
                            <Button type="button" variant="outline" disabled>
                              <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                              Selesai
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                  </TabsContent>
                </div>
              </div>
            </Tabs>

            <DialogFooter className="shrink-0 border-t pt-4 px-2 flex-wrap gap-2">
              <div className="text-sm text-muted-foreground mr-auto">
                {validationErrors.berkas ? (
                  <span className="text-destructive">{validationErrors.berkas}</span>
                ) : (
                  '* Field wajib diisi'
                )}
              </div>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Batal
                </Button>
              </DialogClose>

              {claimEditable && (
                <>
                  {/* Save as draft — basic validation only */}
                  <Button type="submit" variant="outline" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Menyimpan...
                      </>
                    ) : mode === 'create' ? (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Simpan Draft
                      </>
                    ) : (
                      <>
                        <Pencil className="h-4 w-4 mr-2" />
                        Perbarui Data
                      </>
                    )}
                  </Button>

                  {/* Submit complete berkas to Verifikasi Pusat */}
                  <Button
                    type="button"
                    disabled={isPending || !isBerkasLengkap}
                    title={isBerkasLengkap
                      ? 'Kirim pengajuan ke Verifikasi Pusat'
                      : `Lengkapi: ${missingBerkasItems.join(', ')}`}
                    onClick={handleSubmitBerkasLengkap}
                  >
                    <FolderCheck className="h-4 w-4 mr-2" />
                    Berkas Lengkap
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {mode === 'create' && (
        <MemberSearchModal
          open={memberSearchModalOpen}
          onClose={() => setMemberSearchModalOpen(false)}
          onMemberSelect={handleMemberSelect}
        />
      )}
    </>
  );
}
