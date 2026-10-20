import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/rbac-server';
import { hasPermission } from '@/lib/rbac';
import { PERMISSIONS } from '@/lib/rbac';
import {
  DAKEM_CONFIG_KEYS,
  getDakemConfigHistory,
  getDefaultRequiredDocumentMap,
  getMaxDeathClaimPeriodYears,
  getRequiredDocumentOverride,
  updateDakemConfig,
  validateMaxPeriodYears,
  validateRequiredDocuments,
} from '@/lib/server/dakem-config';

const SUPERUSER_ROLE_SLUGS = ['admin', 'administrator', 'owner'];

/** Konfigurasi Dana Kematian hanya boleh dikelola admin pusat. */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  const roleSlug = (user.role?.slug as string) || '';
  const isSuperuser = SUPERUSER_ROLE_SLUGS.includes(roleSlug);
  const canManageSystem = isSuperuser || hasPermission(user, PERMISSIONS.MANAGE_SYSTEM);
  return canManageSystem ? user : null;
}

/**
 * GET /api/dana-kematian/config — konfigurasi aktif + riwayat perubahan.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Hanya admin pusat yang dapat mengelola konfigurasi.', code: 'PERMISSION_DENIED' }, { status: 403 });
  }

  const [maxYears, requiredOverride, history] = await Promise.all([
    getMaxDeathClaimPeriodYears(),
    getRequiredDocumentOverride(),
    getDakemConfigHistory(undefined, 50),
  ]);

  return NextResponse.json({
    data: {
      max_death_claim_period_years: maxYears,
      required_documents: requiredOverride.requiredByFileKey ?? getDefaultRequiredDocumentMap(),
    },
    history,
  });
}

/**
 * PUT /api/dana-kematian/config — perbarui konfigurasi.
 * body: { key: 'max_death_claim_period_years' | 'required_documents',
 *         value: <number | Record<string,boolean>>,
 *         catatan?: string }
 */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Hanya admin pusat yang dapat mengelola konfigurasi.', code: 'PERMISSION_DENIED' }, { status: 403 });
  }

  const body = await request.json();
  const key = body?.key;
  const catatan = body?.catatan ?? null;

  if (key === DAKEM_CONFIG_KEYS.MAX_PERIOD_YEARS) {
    const check = validateMaxPeriodYears(body?.value);
    if (!check.valid) {
      return NextResponse.json({ error: check.message }, { status: 400 });
    }
    const result = await updateDakemConfig({
      key,
      label: 'Batas Maksimal Pengajuan (Tahun)',
      value: check.value,
      updatedBy: admin.id,
      catatan,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ message: 'Konfigurasi batas maksimal pengajuan diperbarui', value: check.value });
  }

  if (key === DAKEM_CONFIG_KEYS.REQUIRED_DOCUMENTS) {
    const check = validateRequiredDocuments(body?.value);
    if (!check.valid) {
      return NextResponse.json({ error: check.message }, { status: 400 });
    }
    const result = await updateDakemConfig({
      key,
      label: 'Dokumen Wajib Pengajuan',
      value: check.value,
      updatedBy: admin.id,
      catatan,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ message: 'Konfigurasi dokumen wajib diperbarui', value: check.value });
  }

  return NextResponse.json({ error: `Key konfigurasi tidak dikenal: ${key}` }, { status: 400 });
}
