'use client';

import { useState } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';
import { ProtectedRoute } from '@/components/rbac/protected-route';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, History, Filter } from 'lucide-react';
import { HistoryTimeline } from '@/components/anggota/HistoryTimeline';
import { useAnggotaHistory } from '@/lib/hooks/use-anggota-history';

interface AnggotaOption {
  id: string;
  nik: string;
  nama_anggota: string;
  nama_cabang?: string | null;
}

export default function HistoryAnggotaPage() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAnggota, setSelectedAnggota] = useState<AnggotaOption | null>(null);
  const [results, setResults] = useState<AnggotaOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const { data: historyData, isLoading, error } = useAnggotaHistory(selectedAnggota?.id || '');

  // Cari anggota berdasarkan NIK/nama (memakai GET /api/anggota).
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/anggota?search=${encodeURIComponent(q)}&limit=10`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSearchError(err.error || 'Gagal mencari anggota. Pastikan Anda memiliki akses data keanggotaan.');
        setResults([]);
        return;
      }
      const json = await res.json();
      setResults((json.data || []).slice(0, 10));
    } catch (e: any) {
      setSearchError(e.message || 'Gagal mencari anggota.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <ProtectedRoute permission={PERMISSIONS.HISTORY_ANGGOTA_VIEW}>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="History Anggota"
            description="Lihat riwayat perubahan data anggota"
          />
          <ToolbarActions />
        </Toolbar>
      </Container>

      <Container>
        <div className="space-y-6">
          {/* Search and Filter Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari berdasarkan NIK atau nama anggota..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch();
                    }}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" onClick={handleSearch} disabled={searching}>
                  <Search className="h-4 w-4 mr-2" />
                  {searching ? 'Mencari...' : 'Cari'}
                </Button>
              </div>

              {searchError && (
                <p className="text-sm text-destructive mt-3">{searchError}</p>
              )}

              {results.length > 0 && (
                <div className="mt-3 border rounded-md divide-y max-h-64 overflow-y-auto">
                  {results.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAnggota(a);
                        setResults([]);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-muted/60 ${
                        selectedAnggota?.id === a.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="text-sm font-medium">{a.nama_anggota}</div>
                      <div className="text-xs text-muted-foreground">
                        NIK {a.nik}{a.nama_cabang ? ` · ${a.nama_cabang}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedAnggota && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Anggota terpilih:</span>
                  <span className="font-medium">{selectedAnggota.nama_anggota}</span>
                  <span className="text-muted-foreground">({selectedAnggota.nik})</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedAnggota(null)}>
                    Ganti
                  </Button>
                </div>
              )}
            </CardHeader>
          </Card>

          {/* History Timeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Riwayat Perubahan</h2>
              </div>
              {historyData && (
                <p className="text-sm text-muted-foreground">
                  Menampilkan {historyData.data.length} dari {historyData.pagination.total} riwayat
                </p>
              )}
            </CardHeader>
            <CardContent>
              <HistoryTimeline history={historyData?.data || []} isLoading={isLoading} />

              {error && (
                <div className="text-center py-8 text-destructive">
                  <p>Gagal memuat riwayat. Silakan pilih anggota yang valid.</p>
                </div>
              )}

              {!isLoading && !error && (!historyData || historyData.data.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Silakan pilih anggota untuk melihat riwayat perubahan.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>Fitur History Anggota</strong> memungkinkan Anda untuk melihat semua perubahan yang terjadi pada data anggota, termasuk:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Pembuatan anggota baru</li>
                  <li>Update data anggota</li>
                  <li>Penghapusan anggota</li>
                  <li>Field yang diubah</li>
                  <li>Waktu perubahan</li>
                  <li>User yang melakukan perubahan</li>
                </ul>
                <p className="text-xs">
                  Riwayat ini sangat berguna untuk audit trail dan debugging masalah data.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </ProtectedRoute>
  );
}