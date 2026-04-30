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

export default function HistoryAnggotaPage() {
  const [selectedAnggotaId, setSelectedAnggotaId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // For this demo page, we'll use a fixed anggota ID
  // In production, you'd have a selector to choose which anggota to view history for
  const demoAnggotaId = selectedAnggotaId || 'demo-anggota-id';

  const { data: historyData, isLoading, error } = useAnggotaHistory(demoAnggotaId);

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
                    className="pl-9"
                  />
                </div>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
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