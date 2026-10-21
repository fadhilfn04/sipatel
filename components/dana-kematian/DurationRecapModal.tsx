'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Timer } from 'lucide-react';

interface DurationRecapModalProps {
  open: boolean;
  onClose: () => void;
}

interface PerClaim {
  id: string;
  cabang_asal_melapor: string | null;
  status_proses: string | null;
  waktu_proses_cabang_hari: number | null;
  waktu_tunggu_pusat_hari: number | null;
  durasi_keseluruhan_hari: number | null;
  jumlah_koreksi: number;
}

interface PerCabang {
  cabang: string;
  jumlah_pengajuan: number;
  jumlah_selesai: number;
  rata_rata_waktu_proses_cabang_hari: number | null;
  rata_rata_waktu_tunggu_pusat_hari: number | null;
  rata_rata_durasi_keseluruhan_hari: number | null;
  total_koreksi: number;
}

interface DurationResponse {
  data: {
    per_claim: PerClaim[];
    per_cabang: PerCabang[];
  };
}

function fmt(days: number | null): string {
  return days === null ? '—' : `${days} hari`;
}

/**
 * Modal ringkasan durasi proses — rekap per cabang & per pengajuan.
 * Tidak ada skor/bobot/peringkat (sesuai ketentuan bisnis).
 */
export function DurationRecapModal({ open, onClose }: DurationRecapModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DurationResponse['data'] | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch('/api/dana-kematian/duration')
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j?.error || 'Gagal memuat')))))
      .then((json: DurationResponse) => setData(json.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat data durasi'))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Ringkasan Durasi Proses
          </DialogTitle>
          <DialogDescription>
            Durasi terukur per tahap (hari) untuk evaluasi proses. Bukan peringkat —
            tidak ada bobot penilaian. Waktu proses cabang, waktu tunggu Pusat, jumlah
            koreksi, dan durasi keseluruhan ditampilkan terpisah.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Memuat data...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="space-y-8">
            <section className="space-y-2">
              <h4 className="font-semibold text-sm">Rekap per Cabang</h4>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-muted text-left">
                    <tr>
                      <th className="px-3 py-2">Cabang</th>
                      <th className="px-3 py-2 text-right">Pengajuan</th>
                      <th className="px-3 py-2 text-right">Selesai</th>
                      <th className="px-3 py-2 text-right">Rata² Proses Cabang</th>
                      <th className="px-3 py-2 text-right">Rata² Tunggu Pusat</th>
                      <th className="px-3 py-2 text-right">Rata² Total</th>
                      <th className="px-3 py-2 text-right">Total Koreksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.per_cabang || []).map((row) => (
                      <tr key={row.cabang} className="border-t">
                        <td className="px-3 py-2 font-medium">{row.cabang}</td>
                        <td className="px-3 py-2 text-right">{row.jumlah_pengajuan}</td>
                        <td className="px-3 py-2 text-right">{row.jumlah_selesai}</td>
                        <td className="px-3 py-2 text-right">{fmt(row.rata_rata_waktu_proses_cabang_hari)}</td>
                        <td className="px-3 py-2 text-right">{fmt(row.rata_rata_waktu_tunggu_pusat_hari)}</td>
                        <td className="px-3 py-2 text-right">{fmt(row.rata_rata_durasi_keseluruhan_hari)}</td>
                        <td className="px-3 py-2 text-right">{row.total_koreksi}</td>
                      </tr>
                    ))}
                    {(data?.per_cabang || []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                          Belum ada data pengajuan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Per pengajuan (ringkas) */}
            <section className="space-y-2">
              <h4 className="font-semibold text-sm">Per Pengajuan</h4>
              <div className="overflow-x-auto rounded-lg border max-h-80 overflow-y-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-muted text-left sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Cabang</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Proses Cabang</th>
                      <th className="px-3 py-2 text-right">Tunggu Pusat</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Koreksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.per_claim || []).map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2">{row.cabang_asal_melapor || '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary">{row.status_proses || '—'}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right">{fmt(row.waktu_proses_cabang_hari)}</td>
                        <td className="px-3 py-2 text-right">{fmt(row.waktu_tunggu_pusat_hari)}</td>
                        <td className="px-3 py-2 text-right">{fmt(row.durasi_keseluruhan_hari)}</td>
                        <td className="px-3 py-2 text-right">{row.jumlah_koreksi}</td>
                      </tr>
                    ))}
                    {(data?.per_claim || []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                          Belum ada data pengajuan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

