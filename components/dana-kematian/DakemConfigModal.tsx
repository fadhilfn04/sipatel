'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Settings2 } from 'lucide-react';
import { getBerkasDocuments } from '@/lib/config/dana-kematian-berkas';

interface DakemConfigModalProps {
  open: boolean;
  onClose: () => void;
}

interface ConfigResponse {
  data: {
    max_death_claim_period_years: number;
    required_documents: Record<string, boolean>;
  };
  history: Array<{
    id: string;
    key: string;
    value_sebelum: unknown;
    value_setelah: unknown;
    updated_by: string | null;
    catatan: string | null;
    created_at: string;
  }>;
}

const CONFIG_LABELS: Record<string, string> = {
  max_death_claim_period_years: 'Batas Maksimal Pengajuan (Tahun)',
  required_documents: 'Dokumen Wajib Pengajuan',
};

/**
 * Modal konfigurasi Dana Kematian — hanya untuk admin pusat
 * (otorisasi ditegakkan di /api/dana-kematian/config).
 */
export function DakemConfigModal({ open, onClose }: DakemConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [maxYears, setMaxYears] = useState<string>('4');
  const [requiredDocs, setRequiredDocs] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<ConfigResponse['history']>([]);

  const docs = getBerkasDocuments();

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dana-kematian/config');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Gagal memuat konfigurasi');

      const body = json as ConfigResponse;
      setMaxYears(String(body.data.max_death_claim_period_years));

      // Gabungkan dengan default agar semua dokumen tampil walau belum dikonfigurasi.
      const merged: Record<string, boolean> = {};
      for (const doc of docs) {
        merged[doc.fileKey] =
          body.data.required_documents[doc.fileKey] ?? !!doc.requiredForLengkap;
      }
      setRequiredDocs(merged);
      setHistory(body.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat konfigurasi');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) {
      setNotice(null);
      loadConfig();
    }
  }, [open, loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const years = Number(maxYears);
      if (!Number.isInteger(years) || years < 1 || years > 50) {
        throw new Error('Batas maksimal pengajuan harus bilangan bulat antara 1 dan 50 tahun.');
      }

      // Simpan kedua konfigurasi (server memvalidasi nilai & mencatat riwayat).
      const payloads = [
        { key: 'max_death_claim_period_years', value: years, catatan: 'Diperbarui dari UI Konfigurasi Dana Kematian' },
        { key: 'required_documents', value: requiredDocs, catatan: 'Diperbarui dari UI Konfigurasi Dana Kematian' },
      ];

      for (const payload of payloads) {
        const res = await fetch('/api/dana-kematian/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan konfigurasi');
      }

      setNotice('Konfigurasi berhasil disimpan.');
      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Konfigurasi Dana Kematian
          </DialogTitle>
          <DialogDescription>
            Pengaturan dinamis untuk seluruh pengajuan. Perubahan hanya memengaruhi
            validasi pengajuan baru — data &amp; dokumen pengajuan yang sudah ada tidak
            diubah atau dihapus.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Memuat konfigurasi...
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-lg border border-green-500/40 bg-green-50 px-3 py-2 text-sm text-green-700">
                {notice}
              </div>
            )}

            {/* Batas masa kedaluwarsa */}
            <section className="space-y-2">
              <h4 className="font-semibold text-sm">Batas Maksimal Pengajuan</h4>
              <p className="text-xs text-muted-foreground">
                Jarak maksimal antara tanggal meninggal dan tanggal pengajuan. Selisih
                tepat {maxYears || '4'} tahun masih memenuhi syarat; lebih dari itu
                tidak memenuhi syarat. Nilai awal mengikuti SKPP yang berlaku.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={maxYears}
                  onChange={(e) => setMaxYears(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">tahun</span>
              </div>
            </section>

            {/* Dokumen wajib/opsional */}
            <section className="space-y-2">
              <h4 className="font-semibold text-sm">Dokumen Wajib / Opsional</h4>
              <p className="text-xs text-muted-foreground">
                Centang dokumen yang wajib sebelum pengajuan dapat dikirim ke Verifikasi
                Pusat. Dokumen yang tidak dicentang bersifat opsional.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {docs.map((doc) => (
                  <div
                    key={doc.fileKey}
                    className="flex items-start gap-2.5 rounded-lg border p-3"
                  >
                    <Checkbox
                      id={`doc-${doc.fileKey}`}
                      checked={requiredDocs[doc.fileKey] === true}
                      onCheckedChange={(checked) =>
                        setRequiredDocs((prev) => ({
                          ...prev,
                          [doc.fileKey]: checked === true,
                        }))
                      }
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <label
                        htmlFor={`doc-${doc.fileKey}`}
                        className="text-sm font-medium cursor-pointer block"
                      >
                        {doc.label}
                      </label>
                      <span className="text-xs text-muted-foreground">
                        {requiredDocs[doc.fileKey] ? 'Wajib' : 'Opsional'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Riwayat perubahan */}
            <section className="space-y-2">
              <h4 className="font-semibold text-sm">Riwayat Perubahan Konfigurasi</h4>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada riwayat perubahan.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {history.map((row) => (
                    <div key={row.id} className="rounded-lg border px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">
                          {CONFIG_LABELS[row.key] || row.key}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(row.created_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="mt-1 text-muted-foreground break-all">
                        Sebelum: {JSON.stringify(row.value_sebelum)} → Sesudah:{' '}
                        {JSON.stringify(row.value_setelah)}
                      </div>
                      <div className="text-muted-foreground">
                        Oleh: {row.updated_by || '—'}
                        {row.catatan ? ` — ${row.catatan}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Tutup
              </Button>
              <Button onClick={handleSave} disabled={loading || saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Simpan Konfigurasi
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

