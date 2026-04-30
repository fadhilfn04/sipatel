'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Star
} from 'lucide-react';
import { DanaKematian } from '@/lib/supabase';
import { allowsReporting } from '@/lib/workflow/dana-kematian-state-machine';

interface ReportData {
  berita_acara?: {
    nomor_berita_acara: string;
    tanggal_pembuatan: string;
    tempat_penyerahan: string;
    metode_penyerahan: 'tunai' | 'transfer';
    saksi_satu_nama: string;
    saksi_satu_nik: string;
    saksi_dua_nama: string;
    saksi_dua_nik: string;
    catatan: string;
  };
  laporan_keuangan?: {
    nomor_laporan: string;
    periode_mulai: string;
    periode_selesai: string;
    total_dana_diterima: number;
    total_dana_diserahkan: number;
    biaya_transaksi: number;
    catatan: string;
  };
  laporan_feedback?: {
    nomor_laporan: string;
    tanggal_laporan: string;
    tingkat_kepuasan: 'sangat_baik' | 'baik' | 'cukup' | 'kurang';
    penilaian_proses: number;
    penilaian_komunikasi: number;
    penilaian_kecepatan: number;
    aspek_positif: string[];
    area_perbaikan: string[];
    saran: string[];
  };
}

interface ReportGenerationSystemProps {
  claim: DanaKematian;
  onUpdate?: (updates: Partial<DanaKematian>) => void;
  onPreview?: (reportUrl: string, type: string) => void;
  readonly?: boolean;
}

export function ReportGenerationSystem({
  claim,
  onUpdate,
  onPreview,
  readonly = false
}: ReportGenerationSystemProps) {
  const [activeTab, setActiveTab] = useState<'berita_acara' | 'laporan_keuangan' | 'laporan_feedback' | null>(null);
  const [reportData, setReportData] = useState<ReportData>({});

  // Check if reporting is allowed
  const canGenerateReports = allowsReporting(claim.status_proses);

  const getReportStatus = (fileUrl: string | null) => {
    if (!fileUrl) return { status: 'missing', label: 'Belum Dibuat', icon: AlertCircle };
    return { status: 'completed', label: 'Selesai', icon: CheckCircle2 };
  };

  const generateReportNumber = (type: 'BA' | 'LK' | 'LF') => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(4, '0');
    return `${type}/DAKEM/${year}${month}/${random}`;
  };

  const handleSaveBeritaAcara = () => {
    if (!reportData.berita_acara) return;

    const fileUrl = `/reports/berita-acara/${claim.id}.pdf`; // Simulated URL
    onUpdate?.({
      file_berita_acara: fileUrl,
      waktu_6: new Date().toISOString()
    });
    setActiveTab(null);
  };

  const handleSaveLaporanKeuangan = () => {
    if (!reportData.laporan_keuangan) return;

    const fileUrl = `/reports/laporan-keuangan/${claim.id}.pdf`; // Simulated URL
    onUpdate?.({
      file_laporan_keuangan: fileUrl
    });
    setActiveTab(null);
  };

  const handleSaveLaporanFeedback = () => {
    if (!reportData.laporan_feedback) return;

    const fileUrl = `/reports/laporan-feedback/${claim.id}.pdf`; // Simulated URL
    onUpdate?.({
      file_laporan_feedback: fileUrl
    });
    setActiveTab(null);
  };

  const handleCompleteReporting = () => {
    const allReportsComplete =
      claim.file_berita_acara &&
      claim.file_laporan_keuangan &&
      claim.file_laporan_feedback;

    if (allReportsComplete) {
      onUpdate?.({
        is_reported: true,
        waktu_7: new Date().toISOString(),
        tanggal_laporan_lengkap: new Date().toISOString(),
        status_proses: 'selesai'
      });
    }
  };

  const reports = [
    {
      key: 'file_berita_acara',
      name: 'Berita Acara Penyerahan',
      description: 'Dokumentasi penyerahan dana kepada ahli waris',
      required: true,
      icon: FileText,
      color: 'blue'
    },
    {
      key: 'file_laporan_keuangan',
      name: 'Laporan Keuangan',
      description: 'Rekonsiliasi dana yang diterima dan diserahkan',
      required: true,
      icon: FileText,
      color: 'green'
    },
    {
      key: 'file_laporan_feedback',
      name: 'Laporan Feedback',
      description: 'Umpan balik dari ahli waris tentang proses',
      required: true,
      icon: Star,
      color: 'purple'
    }
  ];

  const completedReports = reports.filter(r => claim[r.key]).length;

  if (!canGenerateReports && !readonly) {
    return null;
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Sistem Pelaporan (Fase F)</h3>
          <p className="text-sm text-muted-foreground">
            Waktu-6 → Waktu-7: Pembuatan laporan setelah penyerahan dana
          </p>
        </div>
        <Badge variant={completedReports === reports.length ? 'success' : 'secondary'}>
          {completedReports}/{reports.length} Laporan Selesai
        </Badge>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">Progress Laporan</span>
          <span className="text-muted-foreground">{Math.round((completedReports / reports.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              completedReports === reports.length ? 'bg-green-600' : 'bg-blue-600'
            }`}
            style={{ width: `${(completedReports / reports.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Report cards */}
      {!activeTab && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {reports.map((report) => {
            const ReportIcon = report.icon;
            const reportStatus = getReportStatus(claim[report.key]);
            const StatusIcon = reportStatus.icon;

            return (
              <div
                key={report.key}
                className={`p-4 border rounded-lg ${
                  claim[report.key] ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    claim[report.key] ? 'bg-green-100' : `bg-${report.color}-100`
                  }`}>
                    <ReportIcon className={`h-5 w-5 ${
                      claim[report.key] ? 'text-green-600' : `text-${report.color}-600`
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm">{report.name}</h4>
                      <Badge variant={claim[report.key] ? 'success' : 'secondary'} className="text-xs">
                        {reportStatus.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {report.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {claim[report.key] && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onPreview?.(claim[report.key] as string, report.name)}
                          className="h-8 w-8 p-0"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report creation forms */}
      {activeTab === 'berita_acara' && (
        <BeritaAcaraForm
          claim={claim}
          reportData={reportData}
          setReportData={setReportData}
          onSave={handleSaveBeritaAcara}
          onCancel={() => setActiveTab(null)}
          readonly={readonly}
        />
      )}

      {activeTab === 'laporan_keuangan' && (
        <LaporanKeuanganForm
          claim={claim}
          reportData={reportData}
          setReportData={setReportData}
          onSave={handleSaveLaporanKeuangan}
          onCancel={() => setActiveTab(null)}
          readonly={readonly}
        />
      )}

      {activeTab === 'laporan_feedback' && (
        <LaporanFeedbackForm
          claim={claim}
          reportData={reportData}
          setReportData={setReportData}
          onSave={handleSaveLaporanFeedback}
          onCancel={() => setActiveTab(null)}
          readonly={readonly}
        />
      )}

      {/* Action buttons */}
      {!activeTab && !readonly && (
        <div className="flex flex-wrap gap-2">
          {reports.map((report) => (
            <Button
              key={report.key}
              onClick={() => setActiveTab(report.key as any)}
              variant={claim[report.key] ? 'outline' : 'default'}
              size="sm"
              disabled={!!claim[report.key]}
              className="gap-1"
            >
              <FileText className="h-4 w-4" />
              {claim[report.key] ? 'Edit' : 'Buat'} {report.name}
            </Button>
          ))}
        </div>
      )}

      {/* Complete reporting */}
      {!readonly && completedReports === reports.length && !claim.is_reported && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-green-900">Semua Laporan Selesai</h4>
              <p className="text-sm text-green-800 mt-1">
                Anda dapat menyelesaikan proses ini dan menandai sebagai selesai.
              </p>
            </div>
            <Button onClick={handleCompleteReporting} className="gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Selesaikan Proses
            </Button>
          </div>
        </div>
      )}

      {readonly && claim.is_reported && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-900">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Proses Selesai</span>
          </div>
          <p className="text-sm text-green-800 mt-1">
            Semua laporan telah selesai dan proses dana kematian telah selesai pada{' '}
            {new Date(claim.waktu_7 || claim.tanggal_laporan_lengkap || '').toLocaleDateString('id-ID')}
          </p>
        </div>
      )}
    </Card>
  );
}

// Berita Acara Form Component
function BeritaAcaraForm({
  claim,
  reportData,
  setReportData,
  onSave,
  onCancel,
  readonly
}: {
  claim: DanaKematian;
  reportData: ReportData;
  setReportData: (data: ReportData) => void;
  onSave: () => void;
  onCancel: () => void;
  readonly?: boolean;
}) {
  const data = reportData.berita_acara || {
    nomor_berita_acara: generateReportNumber('BA'),
    tanggal_pembuatan: new Date().toISOString().split('T')[0],
    tempat_penyerahan: '',
    metode_penyerahan: 'tunai' as const,
    saksi_satu_nama: '',
    saksi_satu_nik: '',
    saksi_dua_nama: '',
    saksi_dua_nik: '',
    catatan: ''
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h4 className="font-medium">Berita Acara Penyerahan (Berkas-3)</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nomor Berita Acara</Label>
          <Input
            value={data.nomor_berita_acara}
            onChange={(e) => setReportData({
              ...reportData,
              berita_acara: { ...data, nomor_berita_acara: e.target.value }
            })}
            disabled={readonly}
          />
        </div>
        <div>
          <Label className="text-xs">Tanggal Pembuatan</Label>
          <Input
            type="date"
            value={data.tanggal_pembuatan}
            onChange={(e) => setReportData({
              ...reportData,
              berita_acara: { ...data, tanggal_pembuatan: e.target.value }
            })}
            disabled={readonly}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Tempat Penyerahan</Label>
        <Input
          value={data.tempat_penyerahan}
          onChange={(e) => setReportData({
            ...reportData,
            berita_acara: { ...data, tempat_penyerahan: e.target.value }
          })}
          placeholder="Contoh: Kantor PC P2TEL Jakarta"
          disabled={readonly}
        />
      </div>

      <div>
        <Label className="text-xs">Metode Penyerahan</Label>
        <Select
          value={data.metode_penyerahan}
          onValueChange={(value) => setReportData({
            ...reportData,
            berita_acara: { ...data, metode_penyerahan: value as 'tunai' | 'transfer' }
          })}
          disabled={readonly}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tunai">Tunai (Cash)</SelectItem>
            <SelectItem value="transfer">Transfer Bank</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Saksi 1 - Nama</Label>
          <Input
            value={data.saksi_satu_nama}
            onChange={(e) => setReportData({
              ...reportData,
              berita_acara: { ...data, saksi_satu_nama: e.target.value }
            })}
            disabled={readonly}
          />
        </div>
        <div>
          <Label className="text-xs">Saksi 1 - NIK</Label>
          <Input
            value={data.saksi_satu_nik}
            onChange={(e) => setReportData({
              ...reportData,
              berita_acara: { ...data, saksi_satu_nik: e.target.value }
            })}
            disabled={readonly}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Saksi 2 - Nama</Label>
          <Input
            value={data.saksi_dua_nama}
            onChange={(e) => setReportData({
              ...reportData,
              berita_acara: { ...data, saksi_dua_nama: e.target.value }
            })}
            disabled={readonly}
          />
        </div>
        <div>
          <Label className="text-xs">Saksi 2 - NIK</Label>
          <Input
            value={data.saksi_dua_nik}
            onChange={(e) => setReportData({
              ...reportData,
              berita_acara: { ...data, saksi_dua_nik: e.target.value }
            })}
            disabled={readonly}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Catatan</Label>
        <Textarea
          value={data.catatan}
          onChange={(e) => setReportData({
            ...reportData,
            berita_acara: { ...data, catatan: e.target.value }
          })}
          rows={3}
          disabled={readonly}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={readonly}>
          Simpan Berita Acara
        </Button>
        <Button onClick={onCancel} variant="outline">
          Batal
        </Button>
      </div>
    </div>
  );
}

// Laporan Keuangan Form Component
function LaporanKeuanganForm({
  claim,
  reportData,
  setReportData,
  onSave,
  onCancel,
  readonly
}: {
  claim: DanaKematian;
  reportData: ReportData;
  setReportData: (data: ReportData) => void;
  onSave: () => void;
  onCancel: () => void;
  readonly?: boolean;
}) {
  const data = reportData.laporan_keuangan || {
    nomor_laporan: generateReportNumber('LK'),
    periode_mulai: new Date().toISOString().split('T')[0],
    periode_selesai: new Date().toISOString().split('T')[0],
    total_dana_diterima: claim.besaran_dana_kematian,
    total_dana_diserahkan: claim.besaran_dana_kematian,
    biaya_transaksi: 0,
    catatan: ''
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h4 className="font-medium">Laporan Keuangan (Berkas-4)</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nomor Laporan</Label>
          <Input
            value={data.nomor_laporan}
            onChange={(e) => setReportData({
              ...reportData,
              laporan_keuangan: { ...data, nomor_laporan: e.target.value }
            })}
            disabled={readonly}
          />
        </div>
        <div>
          <Label className="text-xs">Tanggal Laporan</Label>
          <Input
            type="date"
            value={data.periode_selesai}
            onChange={(e) => setReportData({
              ...reportData,
              laporan_keuangan: { ...data, periode_selesai: e.target.value }
            })}
            disabled={readonly}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Dana Diterima dari PP</Label>
          <Input
            type="number"
            value={data.total_dana_diterima}
            onChange={(e) => setReportData({
              ...reportData,
              laporan_keuangan: { ...data, total_dana_diterima: parseFloat(e.target.value) }
            })}
            disabled={readonly}
          />
        </div>
        <div>
          <Label className="text-xs">Dana Diserahkan ke Ahli Waris</Label>
          <Input
            type="number"
            value={data.total_dana_diserahkan}
            onChange={(e) => setReportData({
              ...reportData,
              laporan_keuangan: { ...data, total_dana_diserahkan: parseFloat(e.target.value) }
            })}
            disabled={readonly}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Biaya Transaksi</Label>
        <Input
          type="number"
          value={data.biaya_transaksi}
          onChange={(e) => setReportData({
            ...reportData,
            laporan_keuangan: { ...data, biaya_transaksi: parseFloat(e.target.value) }
          })}
          disabled={readonly}
        />
      </div>

      <div>
        <Label className="text-xs">Catatan</Label>
        <Textarea
          value={data.catatan}
          onChange={(e) => setReportData({
            ...reportData,
            laporan_keuangan: { ...data, catatan: e.target.value }
          })}
          rows={3}
          disabled={readonly}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={readonly}>
          Simpan Laporan Keuangan
        </Button>
        <Button onClick={onCancel} variant="outline">
          Batal
        </Button>
      </div>
    </div>
  );
}

// Laporan Feedback Form Component
function LaporanFeedbackForm({
  claim,
  reportData,
  setReportData,
  onSave,
  onCancel,
  readonly
}: {
  claim: DanaKematian;
  reportData: ReportData;
  setReportData: (data: ReportData) => void;
  onSave: () => void;
  onCancel: () => void;
  readonly?: boolean;
}) {
  const data = reportData.laporan_feedback || {
    nomor_laporan: generateReportNumber('LF'),
    tanggal_laporan: new Date().toISOString().split('T')[0],
    tingkat_kepuasan: 'baik' as const,
    penilaian_proses: 4,
    penilaian_komunikasi: 4,
    penilaian_kecepatan: 4,
    aspek_positif: [],
    area_perbaikan: [],
    saran: []
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h4 className="font-medium">Laporan Feedback (Berkas-5)</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nomor Laporan</Label>
          <Input
            value={data.nomor_laporan}
            onChange={(e) => setReportData({
              ...reportData,
              laporan_feedback: { ...data, nomor_laporan: e.target.value }
            })}
            disabled={readonly}
          />
        </div>
        <div>
          <Label className="text-xs">Tanggal Laporan</Label>
          <Input
            type="date"
            value={data.tanggal_laporan}
            onChange={(e) => setReportData({
              ...reportData,
              laporan_feedback: { ...data, tanggal_laporan: e.target.value }
            })}
            disabled={readonly}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Tingkat Kepuasan</Label>
        <Select
          value={data.tingkat_kepuasan}
          onValueChange={(value) => setReportData({
            ...reportData,
            laporan_feedback: { ...data, tingkat_kepuasan: value as any }
          })}
          disabled={readonly}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sangat_baik">Sangat Baik</SelectItem>
            <SelectItem value="baik">Baik</SelectItem>
            <SelectItem value="cukup">Cukup</SelectItem>
            <SelectItem value="kurang">Kurang</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Penilaian Proses (1-5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={data.penilaian_proses}
            onChange={(e) => setReportData({
              ...reportData,
              laporan_feedback: { ...data, penilaian_proses: parseInt(e.target.value) }
            })}
            disabled={readonly}
          />
        </div>
        <div>
          <Label className="text-xs">Penilaian Komunikasi (1-5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={data.penilaian_komunikasi}
            onChange={(e) => setReportData({
              ...reportData,
              laporan_feedback: { ...data, penilaian_komunikasi: parseInt(e.target.value) }
            })}
            disabled={readonly}
          />
        </div>
        <div>
          <Label className="text-xs">Penilaian Kecepatan (1-5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={data.penilaian_kecepatan}
            onChange={(e) => setReportData({
              ...reportData,
              laporan_feedback: { ...data, penilaian_kecepatan: parseInt(e.target.value) }
            })}
            disabled={readonly}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Aspek Positif (pisahkan dengan koma)</Label>
        <Textarea
          value={data.aspek_positif.join(', ')}
          onChange={(e) => setReportData({
            ...reportData,
            laporan_feedback: { ...data, aspek_positif: e.target.value.split(',').map(s => s.trim()) }
          })}
          rows={2}
          disabled={readonly}
        />
      </div>

      <div>
        <Label className="text-xs">Area Perbaikan (pisahkan dengan koma)</Label>
        <Textarea
          value={data.area_perbaikan.join(', ')}
          onChange={(e) => setReportData({
            ...reportData,
            laporan_feedback: { ...data, area_perbaikan: e.target.value.split(',').map(s => s.trim()) }
          })}
          rows={2}
          disabled={readonly}
        />
      </div>

      <div>
        <Label className="text-xs">Saran (pisahkan dengan koma)</Label>
        <Textarea
          value={data.saran.join(', ')}
          onChange={(e) => setReportData({
            ...reportData,
            laporan_feedback: { ...data, saran: e.target.value.split(',').map(s => s.trim()) }
          })}
          rows={2}
          disabled={readonly}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={readonly}>
          Simpan Laporan Feedback
        </Button>
        <Button onClick={onCancel} variant="outline">
          Batal
        </Button>
      </div>
    </div>
  );
}