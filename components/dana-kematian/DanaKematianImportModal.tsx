'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ImportRow, ImportRowResult } from '@/app/api/dana-kematian/import/route';

interface DanaKematianImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'preview' | 'result';

const TEMPLATE_HEADERS = [
  'nik',
  'tanggal_meninggal',
  'nama_ahli_waris',
  'status_ahli_waris',
  'besaran_dana_kematian',
  'penyebab_meninggal',
  'tanggal_lapor_keluarga',
  'tanggal_terima_berkas',
  'keterangan',
];

const TEMPLATE_EXAMPLE = [
  '123456789012345',
  '2024-01-15',
  'Siti Aminah',
  'istri',
  '25000000',
  'Sakit',
  '2024-01-16',
  '2024-01-20',
  'Keterangan tambahan',
];

const COLUMN_LABELS: Record<string, string> = {
  nik: 'NIK *',
  tanggal_meninggal: 'Tgl Meninggal *',
  nama_ahli_waris: 'Nama Ahli Waris *',
  status_ahli_waris: 'Status Ahli Waris *',
  besaran_dana_kematian: 'Besaran Dana *',
  penyebab_meninggal: 'Penyebab Meninggal',
  tanggal_lapor_keluarga: 'Tgl Lapor Keluarga',
  tanggal_terima_berkas: 'Tgl Terima Berkas',
  keterangan: 'Keterangan',
};

const COL_WIDTHS = [20, 18, 25, 18, 22, 20, 22, 22, 30];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
  ws['!cols'] = COL_WIDTHS.map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'template_import_dana_kematian.xlsx');
}

function parseExcel(buffer: ArrayBuffer): ImportRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellText: true, cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  if (raw.length < 2) return [];

  const headers = (raw[0] as string[]).map(h => String(h).trim());

  return raw.slice(1)
    .map(rowArr => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = String((rowArr as unknown[])[i] ?? '').trim();
      });
      return row as unknown as ImportRow;
    })
    .filter(r => Object.values(r).some(v => v));
}

export function DanaKematianImportModal({
  open,
  onClose,
  onSuccess,
}: DanaKematianImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportRowResult[]>([]);
  const [importSummary, setImportSummary] = useState({ total: 0, inserted: 0, failed: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setParsedRows([]);
    setFileName('');
    setParseError('');
    setImportResults([]);
    setImportSummary({ total: 0, inserted: 0, failed: 0 });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError('');
    setFileName(file.name);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (!isExcel) {
      setParseError('Hanya file Excel (.xlsx atau .xls) yang didukung');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const rows = parseExcel(buffer);
        if (rows.length === 0) {
          setParseError('File Excel kosong atau tidak memiliki data selain header');
          return;
        }
        if (rows.length > 500) {
          setParseError('Maksimal 500 baris per import');
          return;
        }
        setParsedRows(rows);
        setStep('preview');
      } catch {
        setParseError('Gagal membaca file Excel. Pastikan format file benar.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const res = await fetch('/api/dana-kematian/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import gagal');

      setImportResults(json.results);
      setImportSummary({ total: json.total, inserted: json.inserted, failed: json.failed });
      setStep('result');

      if (json.inserted > 0) onSuccess();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import gagal');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Data Dana Kematian
          </DialogTitle>
          <DialogDescription>
            Import data massal dari file Excel (.xlsx). Download template terlebih dahulu untuk memastikan format yang benar.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="shrink-0 flex items-center gap-2 text-sm">
          {(['upload', 'preview', 'result'] as Step[]).map((s, i) => {
            const labels = { upload: 'Upload File', preview: 'Preview Data', result: 'Hasil Import' };
            const active = step === s;
            const done = ['upload', 'preview', 'result'].indexOf(step) > i;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  active ? 'bg-primary text-primary-foreground' :
                  done ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                }`}>
                  {done ? <CheckCircle2 className="h-3 w-3" /> : <span>{i + 1}</span>}
                  {labels[s]}
                </div>
                {i < 2 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Template download */}
              <div className="border rounded-xl p-4 bg-blue-50 border-blue-200 flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900 text-sm">Download Template Excel</p>
                  <p className="text-xs text-blue-700 mt-0.5 mb-3">
                    Gunakan template ini sebagai panduan. Kolom bertanda * wajib diisi.<br />
                    Format tanggal: <strong>YYYY-MM-DD</strong> &nbsp;|&nbsp; Status ahli waris: <strong>istri / suami / anak / keluarga</strong>
                  </p>
                  <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100" onClick={downloadTemplate}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download Template (.xlsx)
                  </Button>
                </div>
              </div>

              {/* File upload zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  parseError ? 'border-destructive/50 bg-destructive/5' : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
                }`}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="font-medium text-muted-foreground">Klik untuk upload file Excel</p>
                <p className="text-xs text-muted-foreground mt-1">Format .xlsx atau .xls, maksimal 500 baris data</p>
                {fileName && <p className="text-sm text-primary mt-2 font-medium">{fileName}</p>}
              </div>

              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2.5">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{parseError}</p>
                </div>
              )}

              {/* Column reference */}
              <div className="border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-muted border-b">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kolom yang Dibutuhkan</p>
                </div>
                <div className="divide-y">
                  {TEMPLATE_HEADERS.map(h => (
                    <div key={h} className="flex items-center justify-between px-4 py-2 text-sm">
                      <code className="text-xs font-mono text-primary">{h}</code>
                      <span className="text-muted-foreground text-xs">{COLUMN_LABELS[h]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <strong>{parsedRows.length}</strong> baris siap diimport dari <strong>{fileName}</strong>
                </p>
                <Badge variant="secondary">{parsedRows.length} baris</Badge>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2.5">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{parseError}</p>
                </div>
              )}

              <div className="border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted">
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-10">Tidak</th>
                        {TEMPLATE_HEADERS.map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                            {COLUMN_LABELS[h]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedRows.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/40">
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          {TEMPLATE_HEADERS.map(h => (
                            <td key={h} className="px-3 py-2 max-w-[160px] truncate">
                              {(row as any)[h] || <span className="text-muted-foreground/50">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  Validasi detail (NIK, duplikat, format tanggal) akan dilakukan saat import. Baris dengan error akan dilewati dan dilaporkan.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Result */}
          {step === 'result' && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold">{importSummary.total}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Baris</p>
                </div>
                <div className="border rounded-xl p-4 text-center border-green-200 bg-green-50">
                  <p className="text-2xl font-bold text-green-700">{importSummary.inserted}</p>
                  <p className="text-xs text-green-700 mt-0.5">Berhasil Diimport</p>
                </div>
                <div className={`border rounded-xl p-4 text-center ${importSummary.failed > 0 ? 'border-red-200 bg-red-50' : ''}`}>
                  <p className={`text-2xl font-bold ${importSummary.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {importSummary.failed}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Gagal / Dilewati</p>
                </div>
              </div>

              {/* Per-row results */}
              <div className="border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-muted border-b">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail Hasil</p>
                </div>
                <div className="divide-y max-h-72 overflow-y-auto">
                  {importResults.map(r => (
                    <div key={r.row} className={`flex items-start gap-3 px-4 py-2.5 ${r.success ? '' : 'bg-red-50/60'}`}>
                      {r.success
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          Baris {r.row} — NIK: {r.nik}
                          {r.nama_anggota && <span className="text-muted-foreground font-normal"> ({r.nama_anggota})</span>}
                        </p>
                        {r.error && <p className="text-xs text-destructive mt-0.5">{r.error}</p>}
                        {r.success && <p className="text-xs text-green-700 mt-0.5">Data berhasil disimpan</p>}
                      </div>
                      <Badge variant={r.success ? 'success' : 'destructive'} className="shrink-0 text-xs">
                        {r.success ? 'OK' : 'Gagal'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Tutup</Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => { setStep('upload'); setParseError(''); }}>
                Kembali
              </Button>
              <Button onClick={handleImport} disabled={isImporting || parsedRows.length === 0}>
                {isImporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengimport...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Impor {parsedRows.length} Data</>
                )}
              </Button>
            </>
          )}

          {step === 'result' && (
            <>
              {importSummary.failed > 0 && (
                <Button variant="outline" onClick={() => { setStep('upload'); setParseError(''); }}>
                  Import Ulang
                </Button>
              )}
              <Button onClick={handleClose}>Selesai</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
