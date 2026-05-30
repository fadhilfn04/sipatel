'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileText, Download, Upload, CheckCircle2, Loader2,
  Calendar, Building, Users, Banknote, Plus, ExternalLink,
  Trash2, AlertTriangle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useCurrentUserAnggota } from '@/lib/hooks/use-anggota-api';
import {
  useLaporanPeriodeDakem,
  useClaimsForPeriode,
  useCreateLaporanPeriodeDakem,
  useUpdateLaporanPeriodeDakem,
  useDeleteLaporanPeriodeDakem,
  exportClaimsToCSV,
} from '@/lib/hooks/use-laporan-periode-dakem';
import { LaporanPeriodeDakem } from '@/lib/supabase';

interface LaporanPeriodeModalProps {
  open: boolean;
  onClose: () => void;
}

const MONTHS = [
  { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },   { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },     { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },    { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },{ value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },{ value: '12', label: 'Desember' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => String(currentYear - i));

function formatCurrency(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function LaporanPeriodeModal({ open, onClose }: LaporanPeriodeModalProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [catatan, setCatatan] = useState('');
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const { data: currentUser } = useCurrentUserAnggota();

  const cabang = currentUser?.nama_cabang ?? '';
  const periode = `${selectedYear}-${selectedMonth}`;
  const periodeLabel = `${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;

  const { data: claims, meta, isLoading: loadingClaims } = useClaimsForPeriode(periode, cabang);
  const { data: riwayat, isLoading: loadingRiwayat, refetch: refetchRiwayat } = useLaporanPeriodeDakem(cabang);
  const { create, isLoading: creating } = useCreateLaporanPeriodeDakem();
  const { update, isLoading: updating } = useUpdateLaporanPeriodeDakem();
  const { remove, isLoading: deleting } = useDeleteLaporanPeriodeDakem();

  // Reset state when period changes
  useEffect(() => {
    setUploadedFileUrl('');
    setCatatan('');
    setSaveError('');
    setSavedSuccess(false);
    setUploadError('');
  }, [periode]);

  const alreadySaved = riwayat.some(r => r.periode === periode && r.cabang === cabang);
  const savedLaporan = riwayat.find(r => r.periode === periode && r.cabang === cabang);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'dana-kematian');
      fd.append('folder', 'laporan-periode');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload gagal');
      setUploadedFileUrl(json.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload gagal');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaveError('');
    try {
      if (alreadySaved && savedLaporan) {
        // Update existing (add/replace file)
        await update(savedLaporan.id, {
          file_laporan: uploadedFileUrl || savedLaporan.file_laporan || undefined,
          catatan: catatan || savedLaporan.catatan || undefined,
        });
      } else {
        await create({
          periode,
          periode_label: periodeLabel,
          cabang,
          file_laporan: uploadedFileUrl || undefined,
          catatan: catatan || undefined,
          jumlah_klaim: meta?.jumlah_klaim ?? claims.length,
          total_dana: meta?.total_dana ?? 0,
          created_by: currentUser?.nama_anggota,
        });
      }
      setSavedSuccess(true);
      refetchRiwayat();
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Gagal menyimpan laporan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus laporan ini?')) return;
    await remove(id);
    refetchRiwayat();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-[100vw] max-h-screen p-0 gap-0 overflow-hidden flex flex-col rounded-none">
        {/* Header */}
        <div className="shrink-0 bg-linear-to-r from-slate-800 to-slate-700 text-white px-8 py-5">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-xl font-bold">
                  Laporan Periode Dana Kematian
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-sm mt-0.5">
                  Rekapitulasi klaim selesai per periode — export & upload laporan resmi
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="buat" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="shrink-0 w-full rounded-none border-b bg-background h-11 grid grid-cols-2 max-w-sm mx-8 mt-0 gap-0 justify-start">
            <TabsTrigger value="buat" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Buat Laporan
            </TabsTrigger>
            <TabsTrigger value="riwayat" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Riwayat
              {riwayat.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 h-4">{riwayat.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* ── Tab: Buat Laporan ── */}
            <TabsContent value="buat" className="mt-0 h-full">
              <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">

                {/* Period selector */}
                <div className="border rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Pilih Periode
                  </h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Bulan" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="Tahun" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {cabang && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building className="h-3.5 w-3.5" />
                        {cabang}
                      </div>
                    )}
                    {alreadySaved && (
                      <Badge variant="success" className="ml-auto">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Sudah disimpan
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Summary cards */}
                {meta && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-xl p-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{meta.jumlah_klaim}</p>
                        <p className="text-xs text-muted-foreground">Klaim Selesai</p>
                      </div>
                    </div>
                    <div className="border rounded-xl p-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <Banknote className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-green-700">{formatCurrency(meta.total_dana)}</p>
                        <p className="text-xs text-muted-foreground">Total Dana Tersalurkan</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Claims table */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
                    <h3 className="font-semibold text-sm">
                      Daftar Klaim — {periodeLabel}
                    </h3>
                    {claims.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportClaimsToCSV(claims, periodeLabel, cabang)}
                        className="gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                      </Button>
                    )}
                  </div>

                  {loadingClaims ? (
                    <div className="py-12 text-center">
                      <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Memuat data...</p>
                    </div>
                  ) : claims.length === 0 ? (
                    <div className="py-12 text-center">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground font-medium">Tidak ada klaim selesai</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Belum ada klaim dengan status Selesai pada periode {periodeLabel}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">No</TableHead>
                            <TableHead>NIK</TableHead>
                            <TableHead>Nama Anggota</TableHead>
                            <TableHead>Cabang</TableHead>
                            <TableHead>Tgl Meninggal</TableHead>
                            <TableHead>Nama Ahli Waris</TableHead>
                            <TableHead>Hubungan</TableHead>
                            <TableHead className="text-right">Besaran Dana</TableHead>
                            <TableHead>Tgl Serah</TableHead>
                            <TableHead>Bukti</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {claims.map((claim, i) => (
                            <TableRow key={claim.id}>
                              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                              <TableCell className="font-mono text-xs">{claim.anggota?.nik ?? '—'}</TableCell>
                              <TableCell className="font-medium">{claim.nama_anggota}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{claim.cabang_asal_melapor}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{formatDate(claim.tanggal_meninggal)}</TableCell>
                              <TableCell>{claim.nama_ahli_waris}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs capitalize">{claim.status_ahli_waris}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-700 text-xs whitespace-nowrap">
                                {formatCurrency(claim.besaran_dana_kematian)}
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{formatDate(claim.cabang_tanggal_serah_ke_ahli_waris)}</TableCell>
                              <TableCell>
                                {claim.file_bukti_penyerahan ? (
                                  <a href={claim.file_bukti_penyerahan} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Upload laporan resmi + catatan */}
                {claims.length > 0 && (
                  <div className="border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Upload className="h-4 w-4" /> Upload Laporan Resmi
                    </h3>

                    {/* Upload zone */}
                    <div>
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.xlsx,.xls,.csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                          e.target.value = '';
                        }}
                      />
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                          uploading ? 'border-primary/40 bg-primary/5 cursor-wait' :
                          uploadedFileUrl || savedLaporan?.file_laporan
                            ? 'border-green-400 bg-green-50 hover:bg-green-100'
                            : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
                        }`}
                        onClick={() => !uploading && fileRef.current?.click()}
                      >
                        {uploading ? (
                          <div className="flex items-center justify-center gap-2 text-primary">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Mengupload...</span>
                          </div>
                        ) : uploadedFileUrl ? (
                          <div className="flex items-center justify-center gap-2 text-green-700">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm">File terupload — klik untuk ganti</span>
                          </div>
                        ) : savedLaporan?.file_laporan ? (
                          <div className="flex items-center justify-center gap-2 text-green-700">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm">File sudah ada — klik untuk ganti</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Upload className="h-6 w-6 mx-auto text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">Klik untuk upload laporan resmi (PDF / Excel)</p>
                            <p className="text-xs text-muted-foreground">Opsional — bisa diupload nanti</p>
                          </div>
                        )}
                      </div>
                      {uploadError && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />{uploadError}
                        </p>
                      )}
                    </div>

                    {/* Catatan */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Catatan (opsional)</label>
                      <Textarea
                        placeholder="Catatan tambahan untuk laporan ini..."
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        rows={2}
                      />
                    </div>

                    {/* Save button */}
                    {saveError && (
                      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4 shrink-0" />{saveError}
                      </div>
                    )}
                    {savedSuccess && (
                      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />Laporan berhasil disimpan!
                      </div>
                    )}
                    <Button
                      onClick={handleSave}
                      disabled={creating || updating || uploading}
                      className="w-full"
                    >
                      {creating || updating ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
                      ) : alreadySaved ? (
                        <><CheckCircle2 className="h-4 w-4 mr-2" />Update Laporan</>
                      ) : (
                        <><Plus className="h-4 w-4 mr-2" />Simpan Laporan</>
                      )}
                    </Button>
                  </div>
                )}

              </div>
            </TabsContent>

            {/* ── Tab: Riwayat ── */}
            <TabsContent value="riwayat" className="mt-0 h-full">
              <div className="max-w-5xl mx-auto px-8 py-6">
                {loadingRiwayat ? (
                  <div className="py-16 text-center">
                    <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Memuat riwayat...</p>
                  </div>
                ) : riwayat.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed rounded-xl">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="font-medium text-muted-foreground">Belum ada laporan periode</p>
                    <p className="text-sm text-muted-foreground mt-1">Buat laporan pertama di tab "Buat Laporan"</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {riwayat.map((laporan: LaporanPeriodeDakem) => (
                      <div key={laporan.id} className="border rounded-xl p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Calendar className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{laporan.periode_label}</p>
                            <Badge variant="outline" className="text-xs">{laporan.cabang}</Badge>
                            {laporan.file_laporan ? (
                              <Badge variant="success" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />File tersedia
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Belum ada file</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />{laporan.jumlah_klaim} klaim
                            </span>
                            <span className="flex items-center gap-1">
                              <Banknote className="h-3 w-3" />{formatCurrency(laporan.total_dana)}
                            </span>
                            {laporan.catatan && (
                              <span className="truncate max-w-xs">{laporan.catatan}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {laporan.file_laporan && (
                            <a href={laporan.file_laporan} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                                <Download className="h-3.5 w-3.5" />Download
                              </Button>
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDelete(laporan.id)}
                            disabled={deleting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="shrink-0 border-t bg-background px-8 py-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
