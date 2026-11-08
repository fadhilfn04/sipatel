'use client';

import { useCallback, useEffect, useState } from 'react';
import { Container } from '@/components/common/container';
import { ProtectedRoute } from '@/components/rbac/protected-route';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import {
  Search,
  History,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

interface AuditAnggota {
  id?: string;
  nik?: string;
  nama_anggota?: string;
  nama_cabang?: string;
}

interface AuditRow {
  id: string;
  occurred_at: string;
  module: string;
  table_name: string;
  entity_id: string | null;
  anggota_id: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_role_slug: string | null;
  reason: string | null;
  source: string;
  ip_address: string | null;
  anggota?: AuditAnggota | null;
}

const MODULES: { value: string; label: string }[] = [
  { value: '', label: 'Semua Modul' },
  { value: 'keanggotaan', label: 'Keanggotaan' },
  { value: 'pewarisan_nik', label: 'Pewarisan NIK' },
  { value: 'dana_kematian', label: 'Dana Kematian' },
  { value: 'pelayanan', label: 'Pelayanan' },
  { value: 'keuangan', label: 'Keuangan' },
  { value: 'master_data', label: 'Master Data' },
  { value: 'user_management', label: 'Manajemen Pengguna' },
];

const ACTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua Aksi' },
  { value: 'CREATE', label: 'Buat' },
  { value: 'UPDATE', label: 'Ubah' },
  { value: 'DELETE', label: 'Hapus' },
  { value: 'RESTORE', label: 'Pulihkan' },
  { value: 'APPROVE', label: 'Setujui' },
  { value: 'REJECT', label: 'Tolak' },
  { value: 'VERIFY', label: 'Verifikasi' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGIN_FAILED', label: 'Login Gagal' },
  { value: 'LOGOUT', label: 'Logout' },
];

function actionColor(action: string): string {
  switch (action) {
    case 'CREATE':
      return 'bg-emerald-100 text-emerald-700';
    case 'UPDATE':
      return 'bg-blue-100 text-blue-700';
    case 'DELETE':
    case 'REJECT':
      return 'bg-red-100 text-red-700';
    case 'RESTORE':
      return 'bg-teal-100 text-teal-700';
    case 'APPROVE':
      return 'bg-emerald-100 text-emerald-700';
    case 'VERIFY':
      return 'bg-indigo-100 text-indigo-700';
    case 'LOGIN':
      return 'bg-slate-100 text-slate-700';
    case 'LOGIN_FAILED':
      return 'bg-amber-100 text-amber-800';
    case 'LOGOUT':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function AuditTrailPage() {
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [auditEnabled, setAuditEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (module) params.set('module', module);
      if (action) params.set('action', action);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/audit-trail?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Gagal memuat riwayat aktivitas.');
        setData([]);
        return;
      }
      const json = await res.json();
      setData(json.data || []);
      setTotal(json.pagination?.total || 0);
      setAuditEnabled(json.auditEnabled !== false);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat riwayat aktivitas.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [search, module, action, from, to, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <ProtectedRoute permission={PERMISSIONS.AUDIT_TRAIL_VIEW}>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Riwayat Aktivitas"
            description="Audit trail terpusat seluruh modul SIPATEL"
          />
          <ToolbarActions>
            <Button variant="outline" asChild>
              <a
                href={`/api/audit-trail?export=csv&search=${encodeURIComponent(search)}&module=${module}&action=${action}&from=${from}&to=${to}`}
              >
                <Download className="h-4 w-4 mr-2" />
                Ekspor CSV
              </a>
            </Button>
          </ToolbarActions>
        </Toolbar>
      </Container>

      <Container>
        <div className="space-y-6">
          {/* Filter */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Cari (entitas / pengguna)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ID data, nama pengguna..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Modul</label>
                  <select
                    value={module}
                    onChange={(e) => {
                      setModule(e.target.value);
                      setPage(1);
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {MODULES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Aksi</label>
                  <select
                    value={action}
                    onChange={(e) => {
                      setAction(e.target.value);
                      setPage(1);
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Dari</label>
                    <Input
                      type="date"
                      value={from}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Sampai</label>
                    <Input
                      type="date"
                      value={to}
                      onChange={(e) => {
                        setTo(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {!auditEnabled && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Audit trail belum diaktifkan.</p>
                <p>
                  Jalankan migration{' '}
                  <code className="text-xs">supabase/migrations/036_create_audit_trail.sql</code>{' '}
                  pada database untuk mengaktifkan pencatatan riwayat.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Tabel aktivitas */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Daftar Aktivitas</h2>
              </div>
              <p className="text-sm text-muted-foreground">{total} aktivitas ditemukan</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Memuat riwayat...</div>
              ) : data.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Tidak ada riwayat aktivitas yang ditemukan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Waktu</th>
                        <th className="py-2 pr-4 font-medium">Pengguna</th>
                        <th className="py-2 pr-4 font-medium">Modul</th>
                        <th className="py-2 pr-4 font-medium">Aksi</th>
                        <th className="py-2 pr-4 font-medium">Entitas</th>
                        <th className="py-2 pr-4 font-medium">Field berubah</th>
                        <th className="py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row) => (
                        <tr key={row.id} className="border-b last:border-0 align-top">
                          <td className="py-3 pr-4 whitespace-nowrap">{formatDateTime(row.occurred_at)}</td>
                          <td className="py-3 pr-4">
                            <div className="font-medium">{row.actor_name || row.actor_user_id || 'System'}</div>
                            <div className="text-xs text-muted-foreground">{row.actor_role_slug || '—'}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <div>{MODULES.find((m) => m.value === row.module)?.label || row.module}</div>
                            <div className="text-xs text-muted-foreground">{row.table_name}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge className={actionColor(row.action)}>{row.action}</Badge>
                          </td>
                          <td className="py-3 pr-4">
                            {row.anggota?.nama_anggota ? (
                              <>
                                <div>{row.anggota.nama_anggota}</div>
                                <div className="text-xs text-muted-foreground">NIK {row.anggota.nik}</div>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">{row.entity_id || '—'}</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {(row.changed_fields || []).slice(0, 4).map((f) => (
                                <span key={f} className="rounded bg-muted px-1.5 py-0.5 text-xs">{f}</span>
                              ))}
                              {(row.changed_fields || []).length > 4 && (
                                <span className="text-xs text-muted-foreground">
                                  +{(row.changed_fields || []).length - 4}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <Button variant="outline" size="sm" onClick={() => setDetail(row)}>
                              Detail
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Paginasi */}
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  Halaman {page} dari {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detail diff per field */}
          {detail && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Detail Perubahan</h2>
                  <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>Tutup</Button>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Waktu: {formatDateTime(detail.occurred_at)}</p>
                  <p>
                    Pelaku: {detail.actor_name || detail.actor_user_id || 'System'}
                    {detail.actor_role_slug ? ` (${detail.actor_role_slug})` : ''}
                  </p>
                  <p>
                    Modul: {MODULES.find((m) => m.value === detail.module)?.label || detail.module}
                    {' · '}{detail.table_name}{' · '}{detail.action}
                    {detail.source === 'system' ? ' · oleh sistem' : ''}
                  </p>
                  {detail.reason && <p>Alasan: {detail.reason}</p>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Field</th>
                        <th className="py-2 pr-4 font-medium">Sebelum</th>
                        <th className="py-2 font-medium">Sesudah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.changed_fields || []).map((field) => (
                        <tr key={field} className="border-b last:border-0 align-top">
                          <td className="py-2 pr-4 font-medium">{field}</td>
                          <td className="py-2 pr-4 text-muted-foreground break-all">
                            {formatValue(detail.old_values?.[field])}
                          </td>
                          <td className="py-2 break-all">
                            {formatValue(detail.new_values?.[field])}
                          </td>
                        </tr>
                      ))}
                      {(detail.changed_fields || []).length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-muted-foreground">
                            Tidak ada detail field yang berubah.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Container>
    </ProtectedRoute>
  );
}



