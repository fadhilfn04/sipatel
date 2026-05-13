import { supabaseAdmin } from '@/lib/supabase-storage';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'dana_kematian' | 'dana_sosial' | 'keanggotaan' | 'system';

export type NotificationEventType =
  // Dana Kematian lifecycle
  | 'dana_kematian_created'
  | 'dana_kematian_updated'
  | 'dana_kematian_verifikasi_cabang'
  | 'dana_kematian_proses_pusat'
  | 'dana_kematian_selesai'
  | 'dana_kematian_ditolak'
  | 'dana_kematian_deleted'
  // Document events
  | 'dokumen_verified'
  | 'dokumen_uploaded'
  // System
  | 'system_info';

export interface CreateNotificationInput {
  title: string;
  message: string;
  type?: NotificationType;
  category?: NotificationCategory;
  event_type?: NotificationEventType;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (!supabaseAdmin) {
    console.warn('[createNotification] supabaseAdmin not configured — skipping');
    return;
  }

  try {
    const { error } = await supabaseAdmin.from('notifications').insert({
      title: input.title,
      message: input.message,
      type: input.type ?? 'info',
      category: input.category ?? 'system',
      event_type: input.event_type ?? null,
      link: input.link ?? null,
      metadata: input.metadata ?? {},
      is_read: false,
    });

    if (error) {
      console.error('[createNotification] insert error:', error.message);
    }
  } catch (err) {
    console.error('[createNotification] exception:', err);
  }
}

// ── Typed helpers for each workflow event ─────────────────────────────────────

export function notifyDanaKematianCreated(claimId: string, namaAnggota: string, cabang: string) {
  return createNotification({
    title: 'Pengajuan Dana Kematian Baru',
    message: `Pengajuan baru untuk ${namaAnggota} dari ${cabang} telah dibuat dan masuk dalam antrian proses.`,
    type: 'info',
    category: 'dana_kematian',
    event_type: 'dana_kematian_created',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, cabang },
  });
}

export function notifyDanaKematianVerifikasiCabang(claimId: string, namaAnggota: string, aktor: string) {
  return createNotification({
    title: 'Pengajuan Masuk Verifikasi Cabang',
    message: `Pengajuan dana kematian ${namaAnggota} kini dalam proses verifikasi dokumen di cabang oleh ${aktor}.`,
    type: 'info',
    category: 'dana_kematian',
    event_type: 'dana_kematian_verifikasi_cabang',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, aktor },
  });
}

export function notifyDanaKematianProsesPusat(claimId: string, namaAnggota: string, aktor: string) {
  return createNotification({
    title: 'Pengajuan Dikirim ke Pusat',
    message: `Pengajuan dana kematian ${namaAnggota} telah diajukan ke Pusat untuk diproses oleh ${aktor}.`,
    type: 'success',
    category: 'dana_kematian',
    event_type: 'dana_kematian_proses_pusat',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, aktor },
  });
}

export function notifyDanaKematianSelesai(claimId: string, namaAnggota: string, besaran: number) {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(besaran);
  return createNotification({
    title: 'Pengajuan Dana Kematian Selesai',
    message: `Pengajuan dana kematian ${namaAnggota} telah selesai diproses. Dana sebesar ${formatted} siap disalurkan kepada ahli waris.`,
    type: 'success',
    category: 'dana_kematian',
    event_type: 'dana_kematian_selesai',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, besaran },
  });
}

export function notifyDanaKematianDitolak(claimId: string, namaAnggota: string, keterangan?: string) {
  return createNotification({
    title: 'Pengajuan Dana Kematian Ditolak',
    message: `Pengajuan dana kematian ${namaAnggota} telah ditolak.${keterangan ? ` Alasan: ${keterangan}` : ''}`,
    type: 'error',
    category: 'dana_kematian',
    event_type: 'dana_kematian_ditolak',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, keterangan },
  });
}

export function notifyDanaKematianUpdated(claimId: string, namaAnggota: string, aktor?: string) {
  return createNotification({
    title: 'Data Pengajuan Diperbarui',
    message: `Data pengajuan dana kematian ${namaAnggota} telah diperbarui${aktor ? ` oleh ${aktor}` : ''}.`,
    type: 'info',
    category: 'dana_kematian',
    event_type: 'dana_kematian_updated',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota },
  });
}

export function notifyDokumenVerified(claimId: string, namaAnggota: string, jenisDokumen: string) {
  return createNotification({
    title: 'Dokumen Terverifikasi',
    message: `${jenisDokumen} untuk pengajuan ${namaAnggota} telah diverifikasi dan dinyatakan valid.`,
    type: 'success',
    category: 'dana_kematian',
    event_type: 'dokumen_verified',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, jenis_dokumen: jenisDokumen },
  });
}

export function notifyDanaKematianDeleted(namaAnggota: string) {
  return createNotification({
    title: 'Pengajuan Dana Kematian Dihapus',
    message: `Pengajuan dana kematian ${namaAnggota} telah dihapus dari sistem.`,
    type: 'warning',
    category: 'dana_kematian',
    event_type: 'dana_kematian_deleted',
    link: `/pelayanan/dana-kematian`,
    metadata: { nama_anggota: namaAnggota },
  });
}
