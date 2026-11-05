'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  ExternalLink,
  FileText,
  HeartPulse,
  Loader2,
  PencilLine,
  Save,
  Search,
  Trash2,
  Upload,
  UserCircle,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Toolbar, ToolbarHeading } from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnggotaList } from '@/lib/hooks/use-anggota-api';
import {
  useAnggotaKematianByAnggota,
  useAnggotaKematianList,
  useCreateAnggotaKematian,
  useDeleteAnggotaKematian,
  useUpdateAnggotaKematian,
} from '@/lib/hooks/use-anggota-kematian-api';
import { useHasAnyPermission } from '@/lib/hooks/use-rbac';
import { ENTRY_KEMATIAN_MANAGE_PERMISSIONS } from '@/lib/rbac';
import type { Anggota, AnggotaKematianWithAnggota } from '@/lib/supabase';

interface FormErrors {
  anggota_id?: string;
  tanggal_meninggal?: string;
}

/** Apakah tanggal (YYYY-MM-DD) melewati hari ini? */
function isFutureDate(value: string): boolean {
  if (!value) return false;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed.getTime() > today.getTime();
}

export default function EntryMeninggalDuniaPage() {
  const canManage = useHasAnyPermission(ENTRY_KEMATIAN_MANAGE_PERMISSIONS);

  const formCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [selectedAnggota, setSelectedAnggota] = useState<Anggota | null>(null);
  const [tanggalMeninggal, setTanggalMeninggal] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [editing, setEditing] = useState<AnggotaKematianWithAnggota | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Member picker (debounced NIK/nama search)
  const [nikSearch, setNikSearch] = useState('');
  const [debouncedNik, setDebouncedNik] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  // List search (debounced)
  const [listSearch, setListSearch] = useState('');
  const [debouncedListSearch, setDebouncedListSearch] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedNik(nikSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [nikSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedListSearch(listSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [listSearch]);

  const { data: anggotaData, isLoading: anggotaLoading } = useAnggotaList({
    search: debouncedNik,
    page: 1,
    limit: 20,
  });
  const {
    data: listData,
    isLoading: listLoading,
    refetch: refetchList,
  } = useAnggotaKematianList({
    search: debouncedListSearch,
    page: 1,
    limit: 50,
  });

  // Cek apakah anggota terpilih sudah punya catatan kematian (prefill/anti-duplikasi)
  const { data: existingRecord } = useAnggotaKematianByAnggota(selectedAnggota?.id || '');
  const blockingRecord =
    existingRecord && existingRecord.id !== editing?.id ? existingRecord : null;

  const createMutation = useCreateAnggotaKematian();
  const updateMutation = useUpdateAnggotaKematian(editing?.id || '');
  const deleteMutation = useDeleteAnggotaKematian();

  const anggotaResults: Anggota[] = anggotaData?.data || [];
  const rows: AnggotaKematianWithAnggota[] = listData?.data || [];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const selectedCabang = useMemo(
    () => selectedAnggota?.nama_cabang || editing?.anggota?.nama_cabang || '-',
    [selectedAnggota, editing],
  );

  const handleSelectAnggota = (anggota: Anggota) => {
    setSelectedAnggota(anggota);
    setErrors((prev) => ({ ...prev, anggota_id: undefined }));
    setPickerOpen(false);
  };

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'anggota');
      fd.append('folder', 'surat-kematian');

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Upload gagal');

      // Best-effort: hapus dokumen lama bila ada (hindari file yatim di storage).
      if (fileUrl) {
        await fetch(`/api/upload?url=${encodeURIComponent(fileUrl)}&bucket=anggota`, {
          method: 'DELETE',
        }).catch(() => undefined);
      }

      setFileUrl(json.url);
      toast.success('Surat kematian berhasil diunggah');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload gagal');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = async () => {
    if (!fileUrl) return;
    try {
      await fetch(`/api/upload?url=${encodeURIComponent(fileUrl)}&bucket=anggota`, {
        method: 'DELETE',
      });
      setFileUrl(null);
    } catch {
      toast.error('Gagal menghapus dokumen');
    }
  };

  const resetForm = () => {
    setSelectedAnggota(null);
    setTanggalMeninggal('');
    setFileUrl(null);
    setErrors({});
    setEditing(null);
    setUploadError(null);
    setNikSearch('');
  };

  const handleEdit = (row: AnggotaKematianWithAnggota) => {
    setEditing(row);
    setSelectedAnggota(row.anggota as Anggota | null);
    setTanggalMeninggal((row.tanggal_meninggal || '').slice(0, 10));
    setFileUrl(row.file_surat_kematian || null);
    setErrors({});
    setUploadError(null);
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Entry meninggal dunia berhasil dihapus');
      setPendingDeleteId(null);
      if (editing?.id === id) resetForm();
    } catch (err) {
      toast.error('Gagal menghapus entry', {
        description: err instanceof Error ? err.message : 'Coba lagi nanti',
      });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!editing && !selectedAnggota) nextErrors.anggota_id = 'Pilih anggota terlebih dahulu';
    if (!tanggalMeninggal) nextErrors.tanggal_meninggal = 'Tanggal meninggal wajib diisi';
    else if (isFutureDate(tanggalMeninggal)) {
      nextErrors.tanggal_meninggal = 'Tanggal meninggal tidak boleh di masa depan';
    }
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error('Periksa kembali data entry', {
        description: nextErrors.anggota_id || nextErrors.tanggal_meninggal,
      });
      return;
    }

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          tanggal_meninggal: tanggalMeninggal,
          file_surat_kematian: fileUrl,
        });
        toast.success('Data meninggal dunia berhasil diperbarui');
      } else {
        await createMutation.mutateAsync({
          anggota_id: selectedAnggota!.id,
          tanggal_meninggal: tanggalMeninggal,
          file_surat_kematian: fileUrl,
        });
        toast.success('Data karyawan meninggal dunia berhasil dicatat');
      }
      refetchList();
      resetForm();
    } catch (err) {
      toast.error(editing ? 'Gagal memperbarui entry' : 'Gagal mencatat entry', {
        description: err instanceof Error ? err.message : 'Coba lagi nanti',
      });
    }
  };

  const formatDateOnly = (value: string | null | undefined) => {
    if (!value) return '-';
    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Entry Meninggal Dunia"
            description="Catat data karyawan/anggota meninggal dunia — tanggal meninggal dan surat kematian. Status anggota otomatis diperbarui menjadi meninggal."
          />
        </Toolbar>
      </Container>

      {!canManage ? (
        <Container>
          <Alert variant="destructive">
            <AlertTitle>Akses ditolak</AlertTitle>
            <AlertDescription>Anda tidak memiliki akses ke menu Entry Meninggal Dunia.</AlertDescription>
          </Alert>
        </Container>
      ) : (
      <Container>
        <div ref={formCardRef} className="scroll-mt-20">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="size-4" />
                {editing ? 'Ubah Data Meninggal Dunia' : 'Form Entry Meninggal Dunia'}
              </CardTitle>
              <CardDescription>
                Pilih anggota berdasarkan NIK/Nama, isi tanggal meninggal, dan unggah surat
                kematian (opsional). Pencatatan ini <strong>bukan</strong> pengajuan Dana Kematian.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {blockingRecord && (
                <Alert variant="warning" className="mb-5">
                  <AlertTitle>Anggota sudah tercatat meninggal dunia</AlertTitle>
                  <AlertDescription>
                    {blockingRecord.anggota?.nama_anggota || 'Anggota'} telah tercatat meninggal
                    pada {formatDateOnly(blockingRecord.tanggal_meninggal)}. Gunakan tombol{' '}
                    <strong>Ubah</strong> pada daftar di bawah untuk memperbaiki data.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nik-picker">
                      Nama / NIK Anggota <span className="text-destructive">*</span>
                    </Label>
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="nik-picker"
                          type="button"
                          variant="outline"
                          mode="input"
                          aria-expanded={pickerOpen}
                          disabled={!!editing}
                          className="w-full justify-between font-normal"
                        >
                          {selectedAnggota ? (
                            <span className="flex items-center gap-2 truncate">
                              <span className="font-mono">{selectedAnggota.nik}</span>
                              <span className="text-muted-foreground truncate">
                                {selectedAnggota.nama_anggota}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Cari & pilih NIK/nama anggota...
                            </span>
                          )}
                          <ChevronsUpDown className="ms-auto size-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-(--radix-popper-anchor-width) p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Ketik NIK atau nama anggota..."
                            value={nikSearch}
                            onValueChange={setNikSearch}
                          />
                          <CommandList>
                            {anggotaLoading ? (
                              <div className="space-y-2 p-4">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                              </div>
                            ) : anggotaResults.length === 0 ? (
                              <CommandEmpty>Anggota tidak ditemukan.</CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {anggotaResults.map((anggota) => (
                                  <CommandItem
                                    key={anggota.id}
                                    value={anggota.id}
                                    onSelect={() => handleSelectAnggota(anggota)}
                                  >
                                    <span className="flex w-full items-center gap-2">
                                      <span className="font-mono text-xs">{anggota.nik}</span>
                                      <span className="truncate text-sm">{anggota.nama_anggota}</span>
                                      <span className="ms-auto truncate text-xs text-muted-foreground">
                                        {anggota.nama_cabang}
                                      </span>
                                      {selectedAnggota?.id === anggota.id && (
                                        <Check className="size-4 shrink-0" />
                                      )}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {errors.anggota_id && (
                      <p className="text-xs text-destructive">{errors.anggota_id}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tanggal_meninggal">
                      Tanggal Meninggal Dunia <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="tanggal_meninggal"
                      type="date"
                      value={tanggalMeninggal}
                      onChange={(e) => {
                        setTanggalMeninggal(e.target.value);
                        setErrors((prev) => ({ ...prev, tanggal_meninggal: undefined }));
                      }}
                      disabled={isSubmitting}
                      aria-invalid={!!errors.tanggal_meninggal}
                    />
                    {errors.tanggal_meninggal && (
                      <p className="text-xs text-destructive">{errors.tanggal_meninggal}</p>
                    )}
                  </div>
                </div>

                {selectedAnggota && (
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <UserCircle className="size-4" />
                      Data Anggota Terpilih
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Nama Anggota</p>
                        <p className="text-sm font-medium">{selectedAnggota.nama_anggota}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">NIK</p>
                        <p className="font-mono text-sm">{selectedAnggota.nik}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cabang</p>
                        <p className="text-sm font-medium">{selectedCabang}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status Anggota</p>
                        <Badge variant={selectedAnggota.status_anggota === 'meninggal' ? 'destructive' : 'secondary'}>
                          {selectedAnggota.status_anggota}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload surat kematian (opsional) */}
                <div className="space-y-2">
                  <Label htmlFor="surat-kematian">Surat Kematian (opsional)</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting || uploading}
                    >
                      {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                      {uploading ? 'Mengunggah...' : fileUrl ? 'Ganti Dokumen' : 'Unggah Dokumen'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      id="surat-kematian"
                      type="file"
                      accept=".pdf,image/jpeg,image/png"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    />
                    {fileUrl ? (
                      <span className="flex items-center gap-2 text-sm">
                        <Badge variant="success">Tersimpan</Badge>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                        >
                          Lihat dokumen <ExternalLink className="size-3.5" />
                        </a>
                        <Button
                          type="button"
                          mode="icon"
                          variant="ghost"
                          size="sm"
                          title="Hapus dokumen"
                          onClick={handleRemoveFile}
                        >
                          <X className="size-4" />
                        </Button>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        PDF / JPG / PNG (maks. 5MB). Boleh dikosongkan.
                      </span>
                    )}
                  </div>
                  {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                </div>

                <div className="flex items-center justify-end gap-2.5 border-t border-border pt-5">
                  {editing && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      disabled={isSubmitting}
                    >
                      Batal Ubah
                    </Button>
                  )}
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : editing ? <Save /> : <HeartPulse />}
                    {isSubmitting
                      ? 'Menyimpan...'
                      : editing
                        ? 'Simpan Perubahan'
                        : 'Catat Meninggal Dunia'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </Container>
      )}

      {canManage && (
        <Container className="mt-5">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4" />
                  Riwayat Entry Meninggal Dunia
                </CardTitle>
                <CardDescription>
                  Daftar anggota yang tercatat meninggal dunia beserta dokumennya.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari NIK / nama anggota..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="ps-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {listLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <CalendarDays className="size-10 text-muted-foreground/50" />
                  <div>
                    <p className="text-sm font-medium">Belum ada data meninggal dunia</p>
                    <p className="text-xs text-muted-foreground">
                      Entry yang dicatat melalui form di atas akan tampil di sini.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">DICATAT</TableHead>
                        <TableHead className="text-xs">ANGGOTA</TableHead>
                        <TableHead className="text-xs">CABANG</TableHead>
                        <TableHead className="text-xs">TGL MENINGGAL</TableHead>
                        <TableHead className="text-xs">SURAT KEMATIAN</TableHead>
                        <TableHead className="text-xs">STATUS</TableHead>
                        <TableHead className="text-xs text-right">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs">{formatDateTime(row.dicatat_pada)}</TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">
                              {row.anggota?.nama_anggota || '-'}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {row.anggota?.nik || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{row.anggota?.nama_cabang || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {formatDateOnly(row.tanggal_meninggal)}
                          </TableCell>
                          <TableCell>
                            {row.file_surat_kematian ? (
                              <a
                                href={row.file_surat_kematian}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                              >
                                Lihat <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">Belum ada</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={row.anggota?.status_anggota === 'meninggal' ? 'destructive' : 'secondary'}
                              appearance="ghost"
                            >
                              {row.anggota?.status_anggota || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {pendingDeleteId === row.id ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Button
                                  mode="icon"
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 w-7"
                                  title="Konfirmasi hapus"
                                  disabled={deleteMutation.isPending}
                                  onClick={() => handleDelete(row.id)}
                                >
                                  {deleteMutation.isPending ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <XCircle className="size-3.5" />
                                  )}
                                </Button>
                                <Button
                                  mode="icon"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7"
                                  title="Batal"
                                  onClick={() => setPendingDeleteId(null)}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                <Button
                                  mode="icon"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7"
                                  title="Ubah data"
                                  onClick={() => handleEdit(row)}
                                >
                                  <PencilLine className="size-3.5" />
                                </Button>
                                <Button
                                  mode="icon"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 text-destructive"
                                  title="Hapus entry"
                                  onClick={() => setPendingDeleteId(row.id)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </Container>
      )}
    </Fragment>
  );
}

