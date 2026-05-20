import { supabaseAdmin } from '@/lib/supabase-storage';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'dana_kematian' | 'dana_sosial' | 'keanggotaan' | 'system';

export type NotificationEventType =
  // Dana Kematian lifecycle
  | 'dana_kematian_created'
  | 'dana_kematian_updated'
  | 'dana_kematian_verifikasi_cabang'
  | 'dana_kematian_proses_pusat'
  | 'dana_kematian_verified'
  | 'dana_kematian_penyaluran'
  | 'dana_kematian_selesai'
  | 'dana_kematian_ditolak'
  | 'dana_kematian_deleted'
  // Document events
  | 'dokumen_verified'
  | 'dokumen_uploaded'
  // Dana Sosial lifecycle
  | 'dana_sosial_created'
  | 'dana_sosial_disetujui'
  | 'dana_sosial_ditolak'
  | 'dana_sosial_disalurkan'
  // Anggota / Keanggotaan
  | 'anggota_baru'
  | 'anggota_meninggal'
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
  target_role_slugs?: string[] | null;
}

// Low-level insert — accepts pre-resolved target_role_slugs
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
      target_role_slugs: input.target_role_slugs ?? null,
      is_read: false,
    });

    if (error) {
      console.error('[createNotification] insert error:', error.message);
    }
  } catch (err) {
    console.error('[createNotification] exception:', err);
  }
}

// Resolves routing rules from notification_routing table, then creates notification
async function createNotificationWithRouting(
  eventType: NotificationEventType,
  input: Omit<CreateNotificationInput, 'event_type' | 'target_role_slugs'>,
): Promise<void> {
  if (!supabaseAdmin) return;

  let targetRoles: string[] | null = null;

  try {
    const { data: routing } = await supabaseAdmin
      .from('notification_routing')
      .select('target_role_slugs, is_enabled')
      .eq('event_type', eventType)
      .single();

    if (routing && !routing.is_enabled) return; // routing disabled — skip

    if (routing?.target_role_slugs && routing.target_role_slugs.length > 0) {
      targetRoles = routing.target_role_slugs;
    } else if (routing?.target_role_slugs?.length === 0) {
      // Empty array = send to nobody (effectively disabled)
      return;
    }
    // null routing row = no rule found = send to all (null target)
  } catch {
    // If routing table query fails, fall back to sending to all
  }

  return createNotification({ ...input, event_type: eventType, target_role_slugs: targetRoles });
}

// ── Typed helpers for each workflow event ─────────────────────────────────────

export function notifyDanaKematianCreated(claimId: string, namaAnggota: string, cabang: string) {
  return createNotificationWithRouting('dana_kematian_created', {
    title: 'Pengajuan Dana Kematian Baru',
    message: `Pengajuan baru untuk ${namaAnggota} dari ${cabang} telah dibuat dan masuk dalam antrian proses.`,
    type: 'info',
    category: 'dana_kematian',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, cabang },
  });
}

export function notifyDanaKematianVerifikasiCabang(claimId: string, namaAnggota: string, aktor: string) {
  return createNotificationWithRouting('dana_kematian_verifikasi_cabang', {
    title: 'Pengajuan Masuk Verifikasi Cabang',
    message: `Pengajuan dana kematian ${namaAnggota} kini dalam proses verifikasi dokumen di cabang oleh ${aktor}.`,
    type: 'info',
    category: 'dana_kematian',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, aktor },
  });
}

export function notifyDanaKematianProsesPusat(claimId: string, namaAnggota: string, aktor: string) {
  return createNotificationWithRouting('dana_kematian_proses_pusat', {
    title: 'Pengajuan Dikirim ke Pusat',
    message: `Pengajuan dana kematian ${namaAnggota} telah diajukan ke Pusat oleh ${aktor}.`,
    type: 'success',
    category: 'dana_kematian',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, aktor },
  });
}

export function notifyDanaKematianVerified(claimId: string, namaAnggota: string, aktor: string) {
  return createNotificationWithRouting('dana_kematian_verified', {
    title: 'Pengajuan Disetujui PP',
    message: `Pengajuan dana kematian ${namaAnggota} telah disetujui oleh ${aktor}. Menunggu proses keuangan.`,
    type: 'success',
    category: 'dana_kematian',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, aktor },
  });
}

export function notifyDanaKematianPenyaluran(claimId: string, namaAnggota: string, aktor: string) {
  return createNotificationWithRouting('dana_kematian_penyaluran', {
    title: 'Penyaluran Dana Disetujui Keuangan',
    message: `Penyaluran dana kematian ${namaAnggota} telah disetujui oleh ${aktor}. Menunggu konfirmasi transfer.`,
    type: 'success',
    category: 'dana_kematian',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, aktor },
  });
}

export function notifyDanaKematianSelesai(claimId: string, namaAnggota: string, besaran: number) {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(besaran);
  return createNotificationWithRouting('dana_kematian_selesai', {
    title: 'Transfer Dana Dikonfirmasi — Pengajuan Selesai',
    message: `Dana kematian ${namaAnggota} sebesar ${formatted} telah dikonfirmasi dan siap diserahkan kepada ahli waris.`,
    type: 'success',
    category: 'dana_kematian',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, besaran },
  });
}

export function notifyDanaKematianDitolak(claimId: string, namaAnggota: string, keterangan?: string) {
  return createNotificationWithRouting('dana_kematian_ditolak', {
    title: 'Pengajuan Dana Kematian Ditolak',
    message: `Pengajuan dana kematian ${namaAnggota} telah ditolak.${keterangan ? ` Alasan: ${keterangan}` : ''}`,
    type: 'error',
    category: 'dana_kematian',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota, keterangan },
  });
}

export function notifyDanaKematianUpdated(claimId: string, namaAnggota: string, aktor?: string) {
  return createNotificationWithRouting('dana_kematian_updated', {
    title: 'Data Pengajuan Diperbarui',
    message: `Data pengajuan dana kematian ${namaAnggota} telah diperbarui${aktor ? ` oleh ${aktor}` : ''}.`,
    type: 'info',
    category: 'dana_kematian',
    link: `/pelayanan/dana-kematian`,
    metadata: { claim_id: claimId, nama_anggota: namaAnggota },
  });
}

export function notifyDokumenVerified(claimId: string, namaAnggota: string, jenisDokumen: string) {
  return createNotificationWithRouting('dokumen_verified', {
    title: 'Dokumen Terverifikasi',
    message: `${jenisDokumen} untuk pengajuan ${namaAnggota} telah diverifikasi dan dinyatakan valid.`,
    type: 'success',
    category: 'dana_kematian',
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
    target_role_slugs: null, // broadcast to all
  });
}

// ── Dana Sosial helpers ────────────────────────────────────────────────────────

export function notifyDanaSosialCreated(id: string, namaPemohon: string, jenisBantuan: string) {
  return createNotificationWithRouting('dana_sosial_created', {
    title: 'Pengajuan Dana Sosial Baru',
    message: `Pengajuan dana sosial baru dari ${namaPemohon} (${jenisBantuan}) telah masuk.`,
    type: 'info',
    category: 'dana_sosial',
    link: `/pelayanan/dana-sosial`,
    metadata: { id, nama_pemohon: namaPemohon, jenis_bantuan: jenisBantuan },
  });
}

export function notifyDanaSosialDisetujui(id: string, namaPemohon: string, jumlah: number) {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(jumlah);
  return createNotificationWithRouting('dana_sosial_disetujui', {
    title: 'Pengajuan Dana Sosial Disetujui',
    message: `Pengajuan dana sosial ${namaPemohon} telah disetujui sebesar ${formatted}.`,
    type: 'success',
    category: 'dana_sosial',
    link: `/pelayanan/dana-sosial`,
    metadata: { id, nama_pemohon: namaPemohon, jumlah },
  });
}

export function notifyDanaSosialDitolak(id: string, namaPemohon: string) {
  return createNotificationWithRouting('dana_sosial_ditolak', {
    title: 'Pengajuan Dana Sosial Ditolak',
    message: `Pengajuan dana sosial ${namaPemohon} telah ditolak.`,
    type: 'error',
    category: 'dana_sosial',
    link: `/pelayanan/dana-sosial`,
    metadata: { id, nama_pemohon: namaPemohon },
  });
}

export function notifyDanaSosialDisalurkan(id: string, namaPemohon: string, jumlah: number) {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(jumlah);
  return createNotificationWithRouting('dana_sosial_disalurkan', {
    title: 'Dana Sosial Telah Disalurkan',
    message: `Dana sosial ${namaPemohon} sebesar ${formatted} telah berhasil disalurkan.`,
    type: 'success',
    category: 'dana_sosial',
    link: `/pelayanan/dana-sosial`,
    metadata: { id, nama_pemohon: namaPemohon, jumlah },
  });
}

// ── Anggota / Keanggotaan helpers ─────────────────────────────────────────────

export function notifyAnggotaBaru(id: string, namaAnggota: string, cabang: string) {
  return createNotificationWithRouting('anggota_baru', {
    title: 'Anggota Baru Terdaftar',
    message: `Anggota baru ${namaAnggota} dari cabang ${cabang} telah berhasil didaftarkan.`,
    type: 'info',
    category: 'keanggotaan',
    link: `/keanggotaan`,
    metadata: { id, nama_anggota: namaAnggota, cabang },
  });
}

export function notifyAnggotaMeninggal(id: string, namaAnggota: string, cabang: string) {
  return createNotificationWithRouting('anggota_meninggal', {
    title: 'Anggota Meninggal Dunia',
    message: `${namaAnggota} dari cabang ${cabang} telah dicatat meninggal dunia. Segera proses pengajuan dana kematian jika diperlukan.`,
    type: 'warning',
    category: 'keanggotaan',
    link: `/keanggotaan`,
    metadata: { id, nama_anggota: namaAnggota, cabang },
  });
}
